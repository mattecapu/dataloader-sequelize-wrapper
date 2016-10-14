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
						.map((instance) => wrapAssociationsCalls(instance, this))
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

function wrapAssociationsCalls(sequelizeObject, cache) {
	/* wrap associations accessors to use cache */
	const associations = sequelizeObject.__proto__.Model.associations;
	const associationsCache = new Map();

	Object.keys(associations).forEach((associationKey) => {
		const association = associations[associationKey];

		const accessors = association.accessors;
		const associationName = association.associationAccessor;
		const associatedModel = association.target;
		const associatedPK = associatedModel.primaryKeyAttribute;

		const originalAssociationGetAccessor =
			sequelizeObject[accessors.get].bind(sequelizeObject);

		sequelizeObject[accessors.get] = (...args) => {
			/* can't really handle the general case */
			if (args.length > 0) {
				return originalAssociationGetAccessor.apply(sequelizeObject, args);
			}

			const associatedModelCache = cache.from(associatedModel.name);

			/* assume cache is already primed */
			let primeCachePromise = new Promise(res => res());

			if (!associationsCache.has(associationName)) {
				if (association.associationType === 'BelongsTo') {
					/* this is probably already cached */
					primeCachePromise =
						associatedModelCache.loadMany([
							sequelizeObject[association.foreignKeyAttribute.name]
						]);
				} else {
					/* fetch, cache relationship, prime global cache */
					primeCachePromise =
						originalAssociationGetAccessor().then((result) => {
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
									wrapAssociationsCalls(instance, cache)
								)
							);

							return instances;
						});
				}

				/* cache results' IDs */
				primeCachePromise =
					primeCachePromise.then((instances) =>
						associationsCache.set(
							associationName,
							instances.map(x => x[associatedPK])
						)
					);
			}

			return primeCachePromise.then(() =>
				associatedModelCache.loadMany(associationsCache.get(associationName))
			).then((results) => {
				if (association.isSingleAssociation) {
					return results[0];
				} else {
					return results;
				}
			});
		};

		if (accessors.count) {
			const originalAssociationCountAccessor =
				sequelizeObject[accessors.count].bind(sequelizeObject);

			sequelizeObject[accessors.count] = (...args) => {
				/* can't really handle the general case */
				if (args.length > 0) {
					return originalAssociationCountAccessor.apply(sequelizeObject, args);
				}

				if (!associationsCache.has(associationName)) {
					return originalAssociationCountAccessor();
				} else {
					return associationsCache.get(associationName).length;
				}
			}
		}
	});

	return sequelizeObject;
}
