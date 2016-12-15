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
		}).then((instances) =>
			instances
				.map((instance) =>
					wrapInstanceWithCache(instance, cache)
				)
				.sort((a, b) => {
					const indexOfA = getNormalizedId(a);
					const indexOfB = getNormalizedId(b);
					if (indexOfA < indexOfB) {
						return -1;
					} else if (indexOfA > indexOfB) {
						return +1;
					} else {
						return 0
					}
				})
		)
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
