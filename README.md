# dataloader-sequelize-wrapper
### wrap your Sequelize objects in a dataloader caching layer

## Install
```
npm install dataloader-sequelize-wrapper --save
```

## Usage
```js
import Cache from 'dataloader-sequelize-wrapper';

/* you probably want to import this from another file */
const mySequelizeOrm = new Sequelize({
	// ...
})

const cache = new Cache(mySequelizeOrm);

/* provide a primary key to the load() method */
cache.from('mymodel').load(2)
	.then(x => console.log(x.id));

/* object 2 is not fetched again, object 1 and 3 are */
cache.from('mymodel').loadMany([ 1, 2, 3 ])
	.then(x => x.forEach(y => console.log(y.id)));

/* a cached object exposes all the get*() methods */
cache.from('mymodel').load(4)
	/* the associated object is fetched and cached as well */
	.then(x => x.getAssociatedObject())
	.then(x => console.log(x.id)) // 5

/* object 5 is in cache now and thus
won't be refetched by the following code */
cache.from('myassociatedmodel').load(5)
	.then(x => console.log(x.id))
```

## Features
This package provide a smart caching layer which augments your Sequelize objects with cache-aware relationship accessors.
This is achieved through:

* **Smart caching**. The cache is aware of your Sequelize schema and thus can intercede also when fetching relationship. Thus objects fetched from an association, like in the example, are cached too. This exponentially improves the hit rate of the cache.

* **Immutability**. No object can be modified to avoid consistency disasters. The only allowed operations are addition and deletion from the cache.

* **Minimal API change**. Your code stays the same, but under the hood Sequelize objects are augmented with caching. If you wrote your code neatly, it will be just matter of converting `sequelize.where` calls to `cache.from.load` calls.
If your fetching logic isn't *pure*, immutability will give you problems (but expect problems to always come up from an idempotent interface with a non-idempotent implementation).

## Non-features
Because of immutability, accessing mutating methods on an augmented Sequelize object will fire a warning.
Also the whole thing is designed to work with full objects, so it doesn't support options for any of the methods it wraps with caching. This is unlikely to change in the future because handling the general case and tracking partial objects is way more difficult and prone to error.

## API

#### `class Cache`
It's a container for a dictionary of dataloader-like caches. Each of your Sequelize models gets its cache (lazily).

##### ↪ `from(modelName: string): DataLoader`
Get the cache for model `modelName`.


#### `class DataLoader`
It's a [dataloader cache](https://github.com/facebook/dataloader). Objects of this class are returned by `Cache.from`.

##### ↪ `load/loadMany(id: vary): AugmentedSequelizeObject`
Load objects with the given IDs to cache and returns a promise to them. Objects returned are augmented objects. Order is preserved when possible.

##### ↪ `clear(id: vary)`
Delete the object with the given ID from the cache

##### ↪ `clearAll()`
Wipes the cache


#### `interface AugmentedSequelizeObject`
It's a modified version of a Sequelize object, which exposes every attribute a normal object does but wraps `get*()`, `has*()` and `count*()` accessors for relationships. When invoking `get*()` methods, relationships are also loaded from cache and stored.
Calling any method with args will disable caching for that call.
Calling `add*()`, `set*()`, `create*()` and `remove*()` accessors will "work" (i.e. won't throw) but will fire a warning and obliterate consistency. Don't do that.

## Contribution
PRs and issues are welcome! You can always [tweet me](https://twitter.com/user/mattecapu) anyway.

## License
ISC
