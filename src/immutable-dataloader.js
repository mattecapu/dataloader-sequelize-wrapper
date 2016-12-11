import DataLoader from 'dataloader';

export default class ImmutableDataLoader {
	constructor(loadingFunction) {
		this.cache = new DataLoader(loadingFunction);
		this.keys = new Set();
	}

	load(key) {
		this.keys.add(key.toString());
		return this.cache.load(key.toString());
	}
	loadMany(keys) {
		keys.forEach(key => this.keys.add(key.toString()));
		return this.cache.loadMany(keys.map(x => x.toString()));
	}
	prime(key, value) {
		this.keys.add(key.toString());
		return this.cache.prime(key.toString(), value);
	}

	has(key) {
		return this.keys.has(key.toString());
	}
}
