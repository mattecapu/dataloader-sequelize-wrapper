/*!
	A trans-model cache object
*/

import PeekingDataLoader from './peeking-dataloader';
import wrapInstanceWithCache from './wrap-instance';

/* Normalizes ID to a common representation.
Avoid having two objects considered different
solely because their ID is cast to string or not */
const normalizeID = x => x.toString();

const loadingFunction = (model, cache) =>
	(ids) => {
		const normalizedIDs = ids.map(normalizeID);
		return model.findAll({
			where: { [model.primaryKeyAttribute]: ids }
		}).then((instances) =>
			instances
				.map((instance) => wrapInstanceWithCache(instance, cache))
				.sort((a, b) => {
					const indexOfA = normalizedIDs.indexOf(normalizeID(a[model.primaryKeyAttribute]));
					const indexOfB = normalizedIDs.indexOf(normalizeID(b[model.primaryKeyAttribute]));
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
				new PeekingDataLoader(loadingFunction(model, this));
		}

		return this.caches[modelName];
	}
}
