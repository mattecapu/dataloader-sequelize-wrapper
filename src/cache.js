/*!
	A trans-model cache object
*/

import DataLoaderWithPeeking from './dataloader-with-peeking';
import wrapInstanceWithCache from './wrap-instance';

/* Normalizes ID to a common representation.
Avoid having two objects considered different
solely because their ID is cast to string or not */
const normalizeID = x => x.toString();

const loadingFunction = (model, cache) =>
	(ids) => {
		/* normalized string representation of requested IDs */
		const normalizedIDs = ids.map(normalizeID);
		const getNormalizedId = (obj) =>
			normalizedIDs.indexOf(
				normalizeID(obj[model.primaryKeyAttribute])
			);

		return model.findAll({
			where: {
				[model.primaryKeyAttribute]: ids
			}
		}).then((instances) => {
			const fetchedIDs =
				instances
					.map(x => x[model.primaryKeyAttribute])
					.map(normalizeID);

			/* map each ID to the fetched instance,
			or to null if it didn't fetch anything */
			return normalizedIDs
				.map((id) => {
					const indexOf =
						fetchedIDs.indexOf(id);

					if (indexOf >= 0) {
						return wrapInstanceWithCache(instances[indexOf], cache);
					} else {
						return null;
					}
				})
		});
	};

export default class Cache {
	constructor(ORM) {
		this.ORM = ORM;
		this.caches = {};
	}

	from(modelName) {
		/* lazily create model caches */
		if (!this.caches[modelName]) {
			const model = this.ORM.models[modelName];
			this.caches[modelName] =
				new DataLoaderWithPeeking(loadingFunction(model, this));
		}

		return this.caches[modelName];
	}
}
