# dataloader-sequelize-wrapper
### wrap your Sequelize objects in a dataloader caching layer

## Install
```
npm install dataloader-sequelize-wrapper --save
```
## Usage
```js
import Cache from 'dataloader-sequelize-wrapper';
/* this should be your Sequelize object (the one you get from new Sequelize(...)) */
import mySequelizeOrm from './orm';

const cache = new Cache(mySequelizeOrm);

/* provide primary keys to the load() method */
cache.from('mymodel').load(2)
	.then(x => console.log(x.id));

/* object 2 is not fetched again */
cache.from('mymodel').loadMany([1, 2, 3])
	.then(x => x.forEach(y => console.log(y.id)));

/* the cached object exposes all the get*() methods */
cache.from('mymodel').load(4)
	.then(x => x.getAssociatedObject())
	.then(x => console.log(x.id)) // 5

/* object 5 it's in cache now */
cache.from('myassociatedmodel').load(5)
	.then(x => console.log(x.id))

```
## Explanation
The library exports the class `Cache` which represents a cache for all your Sequelize models.
When you call `Cache.from(modelName)` you get a `DataLoader` object which stores a modified version of your Sequelize objects. You can access every attribute and call every `get*()`, `has*()` or `count*()` method, but **it doesn't support mutations yet** (i.e. no `create*()` or `remove*()` methods are exposed).
So you get almost the same interface of a normal Sequelize object, with all the fetching operations cached.
Eventually, your cache object will store every object you loaded directly or indirectly through associations.

## License
ISC
