/*!
	Wrap relationships accessors of a Sequelize object to use the cache provided
*/

export default function wrapInstanceWithCache(sequelizeObject, cache) {
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
							sequelizeObject[association.foreignKey]
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
									wrapInstanceWithCache(instance, cache)
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
