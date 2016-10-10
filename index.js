import DataLoader from 'dataloader';

class PeekingDataLoader extends DataLoader {
	constructor(fn) {
		super(fn);
		this.keys = new Set();
	}

	load(key) {
		this.keys.add(key.toString());
		return super.load(key.toString());
	}
	loadMany(keys) {
		keys.forEach(key => this.keys.add(key.toString()));
		return super.loadMany(keys.map(x => x.toString()));
	}
	prime(key, value) {
		this.keys.add(key.toString());
		return super.prime(key.toString(), value);
	}

	has(key) {
		return this.keys.has(key.toString());
	}
}

export default class Cache {
	constructor(ORM) {
		this.ORM = ORM;
		this.caches = {};
	}
	from(modelName) {
		if (!this.caches[modelName]) {
			const model = this.ORM.models[modelName];
			this.caches[modelName] = new PeekingDataLoader((ids) => {
				const normalizedIDs = ids.map(x => x.toString());
				return model.findAll({
					where: { [model.primaryKeyAttribute]: ids }
				}).then((instances) =>
					instances
						.map((instance) => new CachingWrapper(instance, this))
						.sort((a, b) => {
							const indexOfA = normalizedIDs.indexOf(a[model.primaryKeyAttribute].toString());
							const indexOfB = normalizedIDs.indexOf(b[model.primaryKeyAttribute].toString());
							if (indexOfA < indexOfB) {
								return -1;
							} else if (indexOfA > indexOfB) {
								return +1;
							} else {
								return 0
							}
						})
				)
			});
		}
		return this.caches[modelName];
	}
}

class CachingWrapper {
	constructor(sequelizeObject, cache) {
		/* clone attributes */
		const attributes = sequelizeObject.__proto__.attributes;
		attributes.forEach((attribute) => {
			this[attribute] = sequelizeObject[attribute];
		});

		/* wrap associations accessors to use cache */
		const associations = sequelizeObject.__proto__.Model.associations;
		this.associationsCache = new Map();
		Object.keys(associations).forEach((associationKey) => {
			const association = associations[associationKey];

			const accessors = association.accessors;
			const associationName = association.associationAccessor;
			const associatedModel = association.target;
			const associatedPK = associatedModel.primaryKeyAttribute;

			this[accessors.get] = () => {
				const associatedModelCache = cache.from(associatedModel.name);
				let primeCachePromise = new Promise(res => res());

				if (!this.associationsCache.has(associationName)) {
					if (association.associationType === 'BelongsTo') {
						/* this is probably already cached */
						primeCachePromise =
							associatedModelCache.loadMany([
								sequelizeObject[association.foreignKeyAttribute.name]
							]);
					} else {
						/* fetch, cache relationship, prime global cache */
						primeCachePromise =
							sequelizeObject[accessors.get]().then((result) => {
								/* as array */
								const instances = [].concat(result);

								/* prime global cache only with new objects
								(otherwise it may rewrite older objects which may have relationships already cached,
								thus reducing cache hits) */
								instances.filter((instance) =>
									!associatedModelCache.has(instance[associatedPK])
								).forEach((instance) =>
									associatedModelCache.prime(
										instance[associatedPK],
										new CachingWrapper(instance, cache)
									)
								);

								return instances;
							});
					}

					/* cache results' IDs */
					primeCachePromise =
						primeCachePromise.then((instances) =>
							this.associationsCache.set(
								associationName,
								instances.map(x => x[associatedPK])
							)
						);
				}

				return primeCachePromise.then(() =>
					associatedModelCache.loadMany(this.associationsCache.get(associationName))
				).then((results) => {
					if (association.isSingleAssociation) {
						return results[0];
					} else {
						return results;
					}
				});
			};

			if (accessors.hasSingle) {
				this[accessors.hasSingle] = sequelizeObject[accessors.hasSingle].bind(sequelizeObject);
			}
			if (accessors.hasAll) {
				this[accessors.hasAll] = sequelizeObject[accessors.hasAll].bind(sequelizeObject);
			}

			if (accessors.count) {
				this[accessors.count] = () => {
					if (!this.associationsCache.has(associationName)) {
						return sequelizeObject[accessors.count]();
					} else {
						return this.associationsCache.get(associationName).length;
					}
				}
			}
		});
	}
}
