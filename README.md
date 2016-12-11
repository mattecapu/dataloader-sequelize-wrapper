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

/* provide primary keys to the load() method */
cache.from('mymodel').load(2)
	.then(x => console.log(x.id));

/* object 2 is not fetched again */
cache.from('mymodel').loadMany([ 1, 2, 3 ])
	.then(x => x.forEach(y => console.log(y.id)));

/* the cached object exposes all the get*() methods */
cache.from('mymodel').load(4)
	/* the associated object is fetched and cached as well */
	.then(x => x.getAssociatedObject())
	.then(x => console.log(x.id)) // 5

/* object 5 it's in cache now */
cache.from('myassociatedmodel').load(5)
	.then(x => console.log(x.id))
```

## Features
This package provide a smart caching layer which augments your Sequelize objects with cache-aware relationship accessors.
This is achieved through:

* **Smart caching**. The cache is aware of your Sequelize schema and thus can intercede also when fetching relationship. Thus objects fetched from an association, like in the example, are cached too. This exponentially improves the hit rate of the cache.

* **Immutability**. Objects may be stored but not modified or deleted. The only thing you can do (unless you want to mess up with the internals) is throw away the cache object altogheter.
This may seem restrictive but isn't really a problem for the use cases I had in mind when I wrote the library. It means you can use this just for fetching data, and that the cache is designed to be short-lived (I suggest to use one per request).

* **Minimal API change**. Your code stays the same, but under the hood Sequelize objects are augmented with caching. If you wrote your code neatly, it will be just matter of converting `sequelize.where` calls to `cache.from.load` calls.
If your fetching logic isn't *pure*, the immutability will give you problems (but expect problems to always come up from an idempotent interface with a non-idempotent implementation).

## Non-features
Because of immutability, no mutating method is exposed, and accessing mutators on an augmented Sequelize object will fire a warning.
Also the whole thing is designed to work with full objects, so it doesn't support options to any of the methods it wraps with caching. This is unlikely to change in the future because handling the general case and tracking partial objects is way more difficult and prone to error.
For a large part of the use cases I can imagine, this is not a problem. Anyway feel free to open an issue if this design becomes too restrictive.

## API

* **`class Cache`**
It's a container for a dictionary of dataloader-like caches. Each of your Sequelize models gets its cache (lazily).
** **`Cache.from(modelName: string): ImmutableDataLoader`**
Get the cache for model `modelName`.

* **class ImmutableDataLoader**
It's a [dataloader cache](https://github.com/facebook/dataloader) which does not allow mutations (no `clear*()` methods).
Objects of this class are returned by `Cache.from`.
** **`ImmutableDataLoader.load/loadMany(id: vary): AugmentedSequelizeObject**
Load objects with the given IDs to cache and returns a promise to them. Objects returned are augmented objects. Order is preserved when possible.

* **interface AugmentedSequelizeObject**
It's a modified version of a Sequelize object, which exposes every attribute a normal object does but only `get*()`, `has*()` and `count*()` accessors for relationships. When invoking `get*()` methods, relationships are also loaded from cache and stored.

## Contribution
PRs and issues are welcome! You can always [tweet me](https://twitter.com/user/mattecapu) anyway.

## License
ISC
