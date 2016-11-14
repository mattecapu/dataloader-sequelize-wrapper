import DataLoader from 'dataloader';

export default class PeekingDataLoader extends DataLoader {
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
