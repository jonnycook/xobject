import _ from 'lodash';
export const reactDisplay = Symbol('reactDisplay');

export function wrapReact(React) {
  let createElement = React.createElement
  React.createElement = function(type, props, ...children) {
    // console.log(type, props, children);
    children = children.map(child => {
      if (child && child[reactDisplay]) {
        child = child[reactDisplay];
        if (_.isFunction(child)) child = child();
      }
      return child;
    });
    return createElement.call(React, type, props, ...children);
  }
}

function makePathGen(comps=[]) {
  return new Proxy({}, {
    get({}, prop) {
      if (prop == '$') return comps;
      else if (prop == '__path') return true;
      return makePathGen(comps.concat(prop));
    }
  })
}

function getPath(path: any): string[] {
  return path.$;
}

export function pather<T>(obj?: T): T {
  return makePathGen();
}

function takePass() {
  let pass = XObject.pass;
  delete XObject.pass;
  return pass;
}

export enum XType {
  object = 'object',
  array = 'array',
}

export enum MutationType {
  set = 'set',
  unset = 'unset',
  insert = 'insert',
  remove = 'remove',
  custom = 'custom',
}

interface IMutationParams {
  pass?: any;
  prop?: string;
}
const IMutationParams_prop = getPath(pather<IMutation>().prop)[0];

interface IMutation extends IMutationParams {
  type: MutationType;
}

interface ISetMutationParams extends IMutationParams {
  value: any;
  prevValue: any;
}
interface ISetMutation extends IMutation, ISetMutationParams {
  type: MutationType.set;
}

interface IUnsetMutationParams extends IMutationParams {}
interface IUnsetMutation extends IMutation, IUnsetMutationParams {
  prop: string;
  type: MutationType.unset;
}

interface IInsertMutationParams extends IMutationParams {
  index: number;
  el: any;
}
interface IInsertMutation extends IMutation, IInsertMutationParams {
  type: MutationType.insert;
}

interface IRemoveMutationParams extends IMutationParams {
  index: number;
  count: number;
  els: any[];
}
interface IRemoveMutation extends IMutation, IRemoveMutationParams {
  type: MutationType.remove;
}

interface ICustomMutation extends IMutation {
  type: MutationType.custom;
}

type Mutation = IInsertMutation | IRemoveMutation | ISetMutation | IUnsetMutation | ICustomMutation;

interface IMutationHandler<T> {
  (type: MutationType.insert, params: IInsertMutationParams): T;
  (type: MutationType.remove, params: IRemoveMutationParams): T;
  (type: MutationType.set, params: ISetMutationParams): T;
  (type: MutationType.unset, params: IUnsetMutationParams): T;
  (type: MutationType, params: IInsertMutationParams | IRemoveMutationParams | ISetMutationParams | IUnsetMutationParams ): T;

}

function constructMutation(type: MutationType, params): Mutation {
  return Object.assign({ type } as IMutation, params);
}

const createMutation: IMutationHandler<Mutation> = function (type, params) {
  return Object.assign({ type } as IMutation, params);
}

createMutation(MutationType.insert, {
  index: 1,
  el: null
})

let _id = 0;

function callObserver(observer: Observer, arg) {
  if (observer.immediate) {
    observer.func(arg);
  }
  else {
    setTimeout(() => {
      observer.func(arg);
    }, 0);
  }
}

let _nextId = 0;

export function _X(type?: XType): any {
  let obj, orgObj;
  let handler;
  let transientProps;

  let funcWatcher;

  let debugMode = false;

  let tag;
  const  _thisId = _nextId++;

  const propObservers: { [key: string]: Observer[] } = {};
  const propObserverObservers = {};
  const observers: Observer[] = [];
  function notifyPropObserverObservers(prop, action) {
    if (prop == 'toString') return;
    if (prop == 'valueOf') return;
    if (propObserverObservers[prop]) {
      try {
        for (let observer of propObserverObservers[prop]) {
          observer(propObservers[prop].length, action);        
        }  
      }
      catch (e) {
        console.log(propObserverObservers[prop]);
        throw e;
      }
    }
  }

  function changed(action, prop, value?, prevValue?, pass?) {
  }

  const fireMutation: IMutationHandler<void> = (type: MutationType, params) => {
    if (params.prop == '$ready') {
      // throw new Error();
    }
    const mutation = constructMutation(type, params);

    for (const observer of observers) {
      callObserver(observer, mutation);
    }
    
    if (IMutationParams_prop in mutation) {
      if (propObservers[mutation.prop]) {
        for (let observer of propObservers[mutation.prop]) {
          callObserver(observer, mutation);
        }
      }  
    }
  }

  const genHandler = {
    [XType.array]: () => {
      const observers = [];
      let map;
    
      // function callObservers(...args) {
      //   for (let observer of observers) {
      //     observer(...args);
      //   }
      // }

      // function changed(index, value?, pass?) {
      //   callObservers({ type: 'set', index, value, pass });        
      // }

      return {
        get(prop) {
          if (prop === Symbol.iterator || prop === 'length') {
            XObject.onAccess(proxy, null);
          }
          else if (_.isNumber(prop) || _.isString(prop) && _.isNumber(parseInt(prop))) {
            XObject.onAccess(proxy, prop);

          }
    
          if (prop === 'set') {
            return function(v) {
              obj = v;
              // callObservers({type: 'set', value: v, pass: takePass()});
              fireMutation(MutationType.set, { value: v, pass: takePass() });
            }
          }
          else if (prop === 'push') {
            return function(el) {
              if (map) el = map(el);
              else {
                if (!el[guardSymbol] && _.isPlainObject(el) || el instanceof XEntryClass) {
                  if (!el._id) {
                    el = XObject.obj(el);                
                  }
                  else {
                    el = X(el);
                  }
                }
              }
    
              funcWatcher?.push?.(el);
              const index = obj.length;
              obj.push(el);
              // callObservers({type: 'insert', index, el, pass: takePass()});
              fireMutation(MutationType.insert, { index, el, pass: takePass() });
            }
          }
          else if (prop === 'unshift') {
            return function(el) {
              if (map) el = map(el);
              else {
                if (!el[guardSymbol] && _.isPlainObject(el) || el instanceof XEntryClass) {
                  if (!el._id) {
                    el = XObject.obj(el);                
                  }
                  else {
                    el = X(el);
                  }
                }
              }
    
              funcWatcher?.unshift?.(el);
              const index = 0;
              obj.unshift(el);
              // callObservers({type: 'insert', index, el, pass: takePass()});
              fireMutation(MutationType.insert, { index, el, pass: takePass() });
            }
          }
          else if (prop === 'pop') {
            return () => {
              const el = obj[obj.length - 1];
              obj.pop();
              fireMutation(MutationType.remove, { index: obj.length, count: 1, els: [ el ], pass: takePass() });  
            }
          }
          else if (prop === 'indexOf') {
            return function(...args) {
              XObject.onAccess(proxy, null);
              return obj.indexOf(...args as [any]);
            };
          }
          else if (prop === 'includes') {
            return function(...args) {
              XObject.onAccess(proxy, null);
              return obj.includes(...args as [any]);
            };
          }
          else if (prop === 'map') {
            return function(...args) {
              XObject.onAccess(proxy, null);
              return obj.map(...args as [any]);
            };
          }
          else if (prop === 'filter') {
            return function(...args) {
              if (debugMode) console.log('===DEBUG filter', args, XObject._onAccess);
              XObject.onAccess(proxy, null);
              return obj.filter(...args as [any]);
            };
          }
          else if (prop === 'find') {
            return function(...args) {
              XObject.onAccess(proxy, null);
              return obj.find(...args as [any]);
            };
          }
          else if (prop === 'splice') {
            return function(start, deleteCount, ...items) {
              const r = funcWatcher?.splice?.(null, start, deleteCount, ...items);
              const ret = obj.splice(start, deleteCount, ...items)
              if (r !== false) funcWatcher?.splice?.(ret, start, deleteCount, ...items);
              if (deleteCount) {
                // callObservers({type: 'remove', index: start, count: deleteCount, els: ret, pass: takePass()});
                fireMutation(MutationType.remove, { index: start, count: deleteCount, els: ret, pass: takePass() });
              }
              else {
                // callObservers({type: 'insert', index: start, el: items[0], pass: takePass()});
                fireMutation(MutationType.insert, { index: start, el: items[0], pass: takePass() });
              }
              return ret;
            }
          }
    
          else if (typeof obj[prop] === 'function') {
            return obj[prop].bind(obj);
          }
          else {
            XObject.lastAccess = { obj: proxy, prop, id: _id++ };
            return obj[prop];
          }
    
        },
        set(index, value) {
          if (index === XObject._arrayMapSymbol) {
            map = value;
          }
          else {
            obj[index] = value;
            // changed(index, value, takePass());
            fireMutation(MutationType.set, { value, prop: index, pass: takePass() });
          }
          return true;
        }
      }
    },
    [XType.object]: () => {
      let onAccessUnsetKey;

      return {
        getPrototypeOf() {
          if (orgObj && orgObj.constructor) {
            return orgObj.constructor.prototype;
          }
          return null;
        },
        get(prop: any) {
          if (!(prop in obj) && onAccessUnsetKey) {
            obj[prop] = onAccessUnsetKey();
            // let pass = takePass();
            fireMutation(MutationType.set, { prop: prop, value: obj[prop], pass: takePass() });
            // for (let observer of observers) {
            //   setTimeout(() => {
            //     observer('set', prop, obj[prop], pass);
            //   }, 0);
            // }
            
            // if (propObservers[prop]) {
            //   for (let observer of propObservers[prop]) {
            //     setTimeout(() => {
            //       observer('set', obj[prop], pass);
            //     }, 0);
            //   }
            // }
          }
    
          // if (prop.indexOf && prop.indexOf('.') !== -1) {
          //   console.log(prop);
          //   const p = prop.substr(0, prop.indexOf('.'));
          //   XObject.onAccess(proxy, p);
          //   return obj[p][prop.substr(prop.indexOf('.') + 1)];
          // }
    
          let called;
          if (!['_id', 'valueOf', 'toString', Symbol.toPrimitive, Symbol.toStringTag, 'hasOwnProperty', 'toJSON', 'constructor'].includes(prop)) {
            XObject.onAccess(proxy, prop);
            called = true;
          }
    
          XObject.lastAccess = { obj: proxy, prop, id: _id++, called };
    
          // if (prop in obj) {
    
          // }
          if (obj.hasOwnProperty(prop)) {
            return obj[prop];
          }
          else if (orgObj.constructor.prototype[prop]) {
            return orgObj.constructor.prototype[prop];
          }
        },
        set(prop:any, value) {
          if (prop === XObject._accessUnsetKeySymbol) {
            onAccessUnsetKey = value;
          }
          else if (prop === XObject._contentsSymbol) {
            obj = value;
          }
          else if (prop === XObject._orgSymbol) {
            orgObj = value;
          }

          value = X(value);

    
          // if (prop.indexOf && prop.indexOf('.') !== -1) {
          //   const p = prop.substr(0, prop.indexOf('.'));
          //   obj[p][prop.substr(prop.indexOf('.') + 1)] = value;
          //   return true;
          // }
    
    
          if (obj[prop] === value) return true;
          if (_.isEqual(x(obj[prop]), x(value))) return true;
    
          const prevValue = obj[prop];
  
          obj[prop] = value;
    
          fireMutation(MutationType.set, { prop, value, prevValue, pass: takePass() });
          return true;
        },
        ownKeys() {
          XObject.onAccess(proxy, null);
          return Object.keys(obj);
        },
        getOwnPropertyDescriptor() {
          return {
            enumerable: true,
            configurable: true,
          };
        },
        deleteProperty(prop) {
          delete obj[prop];
          fireMutation(MutationType.unset, { prop, pass: takePass() });
          return true;
        }
      }
    }
  }

  if (type) {
    handler = genHandler[type]();
  }

  const proxy = new Proxy({}, {
    getPrototypeOf({}) {
      if (!handler) throw new Error('not inited');

      if (transientProps) {
        if (transientProps.hasOwnProperty('')) {
          transientProps[''].get('prototype');
        }
      }

      return handler?.getPrototypeOf?.() || null;
    },
    get({}, p) {
      // if (!handler) throw new Error('not inited');

      if (p === XObject._orgSymbol) return orgObj;
      else if (p === XObject._contentsSymbol) return obj;
      else if (p === XObject._tagSymbol) return tag;
      else if (p === XObject._typeSymbol) return type;
      else if (p === XObject._idSymbol) {
        return _thisId;
      }
      else if (p === XObject._fireMutationSymbol) return fireMutation;
      else if (p === XObject._observeSymbol) {
        return function(prop, observer, immediate) {
          if (prop == 'hasOwnProperty') return true;
          if (prop == 'toString') return true;
          if (prop == 'valueOf') return true;
          if (prop == 'push') return true;

          if (prop) {
            if (!propObservers[prop]) propObservers[prop] = [];
            try {
              propObservers[prop].push({ func: observer, immediate });
            }
            catch (e) {
              console.log(prop, propObservers, orgObj, e);
              notifyPropObserverObservers(prop, 'add');
            }
            return true;
          }
          else {
            observers.push({ func: observer, immediate });
            return true;
          }
        }
      }
      else if (p === XObject._removeObserverSymbol) {
        return function(prop, observer) {
          if (prop == 'hasOwnProperty') return true;
          if (prop == 'valueOf') return true;
          if (prop == 'toString') return true;
          if (prop == 'push') return true;
          if (prop) {
            if (!propObservers[prop]) propObservers[prop] = [];
            if (!_.isFunction(propObservers[prop].findIndex)) {
              console.log(orgObj, propObservers, prop);
            }
            const index = propObservers[prop].findIndex(o => o.func == observer);
            if (!propObservers[prop].findIndex) {
              console.log(prop, propObservers, orgObj);
            }
            if (index != -1) {
              propObservers[prop].splice(index, 1);
              notifyPropObserverObservers(prop, 'remove');
              return true;
            }
          }
          else {
            const index = observers.findIndex(o => o.func == observer);
            if (index != -1) {
              observers.splice(index, 1);
              return true;
            }
          }
        }
      }
      else if (p == XObject._observeObserversSymbol) {
        return function(prop, observer) {
          if (!propObserverObservers[prop]) {
            propObserverObservers[prop] = [];
          }
          propObserverObservers[prop].push(observer);
        }
      }
      else if (p === XObject._changedSymbol) {
        return p => {
          fireMutation(MutationType.set, { prop: p });
        }
      }
      else if (transientProps) {
        if (transientProps.hasOwnProperty(p)) {
          if (transientProps[p].trackAccess) XObject.onAccess(proxy, p);
          return transientProps[p].get();
        }

        if (transientProps.hasOwnProperty('')) {
          transientProps[''].get?.(p);
        }
      }

      return handler?.get?.(p);
    },
    set({}, p, value) {
      // if (!handler) throw new Error('not inited');

      if (p == '$ready') {
        throw new Error();
      }
      if (p === XObject._orgSymbol) {
        orgObj = value;
        return true;
      }
      else if (p === XObject._tagSymbol) {
        tag = value;
        return true;
      }

      else if (p === XObject._contentsSymbol) {
        obj = value;
        return true;
      }
      else if (p === XObject._typeSymbol) {
        if (type != value) {
          type = value;
          handler = genHandler[type]();
        }
        return true;
      }
      else if (p === XObject._transientSymbol) {
        // console.log(value);
        transientProps = value;
        return true;
      }
      else if (p === '__funcWatcher') {
        funcWatcher = value;
        return true;
      }
      else if (p === '__debugMode') {
        debugMode = value;
        return true;
      }
      else if (transientProps) {
        if (transientProps.hasOwnProperty('')) {
          transientProps[''].set?.(p, value);
        }
      }

      if (debugMode) {
        console.log(transientProps);
      }

      return handler?.set(p, value);
    },
    ownKeys({}) {
      if (!handler) throw new Error('not inited');

      return handler?.ownKeys?.();
    },
    getOwnPropertyDescriptor({}) {
      if (!handler) throw new Error('not inited');
      return handler?.getOwnPropertyDescriptor?.();
    },
    deleteProperty({}, p) {
      if (!handler) throw new Error('not inited');

      return handler?.deleteProperty?.(p);
    }
  });

  return proxy;
}

type ObserverFunc = (mutation: Mutation) => void;
type Observer = { func: ObserverFunc, immediate: boolean };

export interface DeepMutation {
  type: 'set' | 'insert' | 'remove' | 'custom' | 'unset';
  path: string[];
  prevValue?: any;
  pass: any;
  el?: any;
  value?: any;
  index?: any;
  key?: any;

  customMutation?: any;
}
type DeepObserver = (mutation: DeepMutation) => void;

type XObjectType = {
  value: <T=any>(__: T) => IXValue<T>;
  push(o, prop, value)
  unshift(o, prop, value)
  lastAccess: any;
  _contentsSymbol: any;
  _orgSymbol: any;
  _typeSymbol: any;
  _observeSymbol: any;
  _observeObserversSymbol; any;
  _removeObserverSymbol: any;
  _arrayMapSymbol: any;
  _accessUnsetKeySymbol: any;
  _transientSymbol: any;
  _changedSymbol: any;
  _idSymbol: any;
  _fireMutationSymbol: any;
  _tagSymbol: any;
  // get<T=any>(obj, prop: string | number, defaultValue?: T): T;
  get: any;
  observe: {
    (o: any, prop: string, observer: ObserverFunc, immediate?: boolean): boolean;
    (o: any, observer: DeepObserver, cb?: Function, immediate?: boolean): boolean;
  };
  removeObserver: any;
  observeObservers: any;
  isArray: any;
  isObject: any;
  onAccess: any;
  captureAccesses: any;
  obj<T=any>(obj?): any;
  // obj<T>(obj: T): T & { _id: string };

  id: any;
  pass: any;
  withPass(pass: any, block: () => void): void;
  _onAccess: any;

  changed: (proxy: any, prop?: any) => void;

} & ((__, ___) => any)


function _XObject() {
  return _X(XType.object);
}
export const XObject = function(obj = {}, orgObj=null) {
  const proxy = _XObject();
  proxy[XObject._contentsSymbol] = obj;
  proxy[XObject._orgSymbol] = orgObj;
  return proxy;
} as any as XObjectType;

const ObjectID = (m = Math, d = Date, h = 16, s = s => m.floor(s).toString(h)) => s(d.now() / 1000) + ' '.repeat(h).replace(/./g, () => s(m.random() * h))

XObject.id = function() {
  return ObjectID();
}

export interface IXValue<T=any> {
  obj?(): any;
  get(): T;
  set(value: T): T;
  [reactDisplay]?: any;

  prop?: string;
  observe?
}

XObject.value = (__): IXValue => {
  const access = XObject.lastAccess;
  return {
    obj() { return access.obj },
    get() { return access.obj[access.prop] },
    set(value) {
      return access.obj[access.prop] = value;
    },
    [reactDisplay]: () => access.obj[access.prop],
    prop: access.prop,
    observe(observer) {
      return XObject.observe(access.obj, access.prop, observer);
    }
  }
}

XObject.withPass = (pass, block) => {
  XObject.pass = pass;
  block();
  delete XObject.pass;
}


export const XX = XObject.value;

XObject._contentsSymbol = Symbol('contents');
XObject._orgSymbol = Symbol('org');
XObject._typeSymbol = Symbol('type');
XObject._observeSymbol = Symbol('observe');
XObject._changedSymbol = Symbol('changed');
XObject._observeObserversSymbol = Symbol('observeObservers');
XObject._removeObserverSymbol = Symbol('removeObserver');
XObject._arrayMapSymbol = Symbol('arrayMap');
XObject._accessUnsetKeySymbol = Symbol('accessUnsetKey');
XObject._transientSymbol = Symbol('transient');
XObject._fireMutationSymbol = Symbol('fireMutation');
XObject._tagSymbol = Symbol('tag');
XObject._idSymbol = Symbol('id');

XObject.get = function(o, prop, defaultValue) {
  if (!o[prop]) {
    return o[prop] = _.isFunction(defaultValue) ? X(defaultValue()) : X(defaultValue);
  }
  else {
    return o[prop];
  }
}

function _observeChanges(obj, path = [], observer: DeepObserver, cb, immediate=false) {
  if (XObject.isObject(obj)) {
    let handler: ObserverFunc;
    if (XObject.observe(obj, null, handler = mutation => {
      if (mutation.type == MutationType.set) {
        const completePath = path.concat(mutation.prop);
        _observeChanges(mutation.value, completePath, observer, cb);
        observer({ type: 'set', path: completePath, value: mutation.value, prevValue: mutation.prevValue, pass: mutation.pass, el: obj });  
      }
      else if (mutation.type == MutationType.unset) {
        const completePath = path.concat(mutation.prop);
        observer({ type: 'unset', path: completePath, pass: mutation.pass, el: obj });  
      }
      else {
        console.log(mutation);
        throw new Error('unhandled mutation');
      }
    })) {
      if (cb) {
        cb(obj, null, handler);
      }  
    }

    for (const key of Object.keys(obj)) {
      _observeChanges(obj[key], path.concat(key), observer, cb);
    }
  }
  else if (XObject.isArray(obj)) {
    let handler: ObserverFunc;
    if (XObject.observe(obj, null, handler = mutation => {
      // console.log(mutation)
      if (mutation.type === MutationType.insert) {
        if (mutation.el?._id) {
          _observeChanges(mutation.el, path.concat('&' + mutation.el._id), observer, cb);
          observer({ type: 'insert', path: path.concat(mutation.index), el: mutation.el, pass: mutation.pass });
        }
        else {
          _observeChanges(mutation.el, path.concat(mutation.index), observer, cb);
          observer({ type: 'insert', path: path.concat(mutation.index), el: mutation.el, pass: mutation.pass });
        }
      }
      else if (mutation.type === MutationType.remove) {
        if (mutation.els[0]?._id) {
          observer({ type: 'remove', path: path, key: mutation.els[0]._id, pass: mutation.pass });  
        }
        else {
          observer({ type: 'remove', path: path, index: mutation.index, pass: mutation.pass });  
        }
      }
      else if (mutation.type === MutationType.set) {
        if (!obj[mutation.prop]) {
          // console.log(x(obj), mutation.prop, mutation);
        }
        const comp = obj[mutation.prop]?._id ? '&' + obj[mutation.prop]._id : mutation.prop;
        _observeChanges(mutation.value, path.concat(comp), observer, cb);
        observer({ type: 'set', path: path.concat(comp), value: mutation.value, pass: mutation.pass, el: obj });
      }
      else if (mutation.type === MutationType.custom) {
        observer({ type: 'custom', path: path, pass: mutation.pass, customMutation: mutation } as any);

      }
      else {
        console.log(mutation);
        throw new Error('unhandled mutation');
      }
    })) {
      if (cb) {
        cb(obj, null, handler);
      }  
    }
    for (let i = 0; i < obj.length; ++ i) {
      if (obj[i] !== null && obj[i] !== undefined) {
        const comp = obj[i]._id ? '&' + obj[i]._id : i;
        _observeChanges(obj[i], path.concat(comp), observer, cb);  
      }
    }
  }
}


// XObject.observe = function(o, prop, observer, cb?, immediate=false) {
XObject.observe = function(...args) {
  if (_.isFunction(args[1])) {
    const [ o, observer, cb, immediate ] = args;
    return _observeChanges(o, [], observer, cb, true);//immediate);
  }
  else {
    const [ o, prop, observer, immediate ] = args;
    if (_.isFunction(o?.[XObject._observeSymbol])) {
      return o[XObject._observeSymbol](prop, observer, true);// immediate);
    }
  }
}

XObject.removeObserver = function(o, prop, observer) {
  return o[XObject._removeObserverSymbol](prop, observer);
}

XObject.observeObservers = function(o, prop, observer) {
  o[XObject._observeObserversSymbol](prop, observer);
}

XObject.isArray = function(obj) {
  return obj && obj[XObject._typeSymbol] === 'array';
}

XObject.isObject = function(obj) {
  return obj && obj[XObject._typeSymbol] === 'object';
}

XObject._onAccess = [];

XObject.onAccess = function(...args) {
  for (const func of this._onAccess) {
    func(...args);
  }
}

XObject.captureAccesses = function(func, onAccess) {
  XObject._onAccess.push(onAccess);
  const result = func();
  XObject._onAccess.pop();
  return result;
}

// XObject.captureAccesses = function(func, onAccess) {
//   const oldOnAccess = this._onAccess;
//   XObject._onAccess = onAccess;
//   const result = func();
//   XObject._onAccess = oldOnAccess;
//   return result;
// }


XObject.obj = function(obj:any ={}) {
  if (obj._id) {
    return XObject(XMap(obj), obj);
  }
  else {
    return XObject(Object.assign({}, XMap(obj), { _id: XObject.id() }), obj);
  }
}

function resolvePath(path) {
  if (path.__path) path = path.$;

  if (_.isArray(path)) {
    return path[0];
  }
  else {
    return path;
  }
}

XObject.changed = (proxy, path) => {
  proxy[XObject._changedSymbol](resolvePath(path));
}

function _XArray() {
  return _X(XType.array);
}

export function XArray(list=[]) {
  const proxy = _XArray();
  proxy[XObject._contentsSymbol] = list;
  return proxy;
};

export function XInit<T>(klass: (new () => T)): T {
  let t = new klass();
  return XMap(t, true);

}

export type XID = string | number;

export type XEntry = {
  _id?: XID;
}

export class XEntryClass {
  _id?: XID;
}

export function XMap<T>(obj: T, force=false, map?: Map<any, any>, _proxy?, onVisit?: any, path?): T {
  let anyObj = obj as any;
  if (obj === undefined || obj === null || obj[XObject._typeSymbol] || obj[guardSymbol]) return obj;

  if (!map) {
    map = new Map();
  }
  else {
    let o = map.get(obj);
    if (o !== undefined) return o;
  }

  if (_.isArray(obj)) {
    const proxy = _proxy || _XArray();
    if (_proxy) {
      _proxy[XObject._typeSymbol] = XType.array;
    }
    map.set(obj, proxy);

    if (_.isArray(path)) {
      proxy[XObject._tagSymbol] = path.join('.');
    }

    proxy[XObject._contentsSymbol] = anyObj.map((value, i) => {
      let nextPath;
      if (path === true) {
        nextPath = [ i ];
      }
      else if (_.isArray(path)) {
        nextPath = path.concat(i);
      }

      return XMap(value, undefined, map, undefined, onVisit, nextPath);
    });

    onVisit?.(proxy);

    return proxy;
  }
  else if ((obj instanceof Object && !(obj instanceof Date) && !(obj instanceof Function)) || force) {
    const proxy = _proxy || _XObject();
    if (_proxy) {
      _proxy[XObject._typeSymbol] = XType.object;
    }
    map.set(obj, proxy);

    if (_.isArray(path)) {
      proxy[XObject._tagSymbol] = path.join('.')
    }


    proxy[XObject._contentsSymbol] = _.mapValues(obj as any, (value, key) => {
      // const value = obj[key];
      let nextPath;
      if (path === true) {
        nextPath = [ key ];
      }
      else if (_.isArray(path)) {
        nextPath = path.concat(key);
      }
      return XMap(value, undefined, map, undefined, onVisit, nextPath);
    });
    proxy[XObject._orgSymbol] = obj;

    onVisit?.(proxy);

    return proxy;
  }
  else {
    return obj;
  }
}

export function XClone<T>(obj: T): T {
  return X(x(obj));
}

const guardSymbol = Symbol('guardSymbol');

export function XGuard<T>(obj: T): T {
  return { [guardSymbol]: obj } as any;
}


export function XStrip<T>(obj: T, recursive=true, map?: Map<any, any>): T {
  if (obj === null) return null;
  else if (obj === undefined) return undefined;

  if (!map) {
    map = new Map();
  }
  else {
    let o = map.get(obj);
    if (o !== undefined) return o;
  }

  if (typeof obj == 'object' && guardSymbol in obj) {
    return (obj as any)[guardSymbol];
  }


  let constructor, orgObj = obj;
  if (obj[XObject._typeSymbol]) {
    let org = obj[XObject._orgSymbol];
    if (org && org.constructor != Object && org.constructor != Array) constructor = org.constructor;
    obj = obj[XObject._contentsSymbol];
  }

  if (_.isArray(obj)) {
    let o = [];
    map.set(orgObj, o);
    
    o.splice(0, 0, ...obj.map(v => {
      if (recursive) {
        return XStrip(v, undefined, map);
      }
      else {
        return v;
      }
    }));

    return o as any;
  }
  else if (_.isPlainObject(obj)) {
    let r;
    if (constructor) {
      r = Object.create(constructor.prototype);
    }
    else {
      r = {};
    }
    map.set(orgObj, r);


    let values = _.mapValues(obj as any, (v) => {
      if (recursive) {
        return XStrip(v, undefined, map);
      }
      else {
        return v;
      }
    });

    for (let key in values) r[key] = values[key];

    return r;
  }
  else {
    return obj;
  }
}

export const X = XMap;
export const x = XStrip;


function _isArray(value) {
  return _.isArray(value) || XObject.isArray(value);
}

function _isObject(value) {
  return _.isPlainObject(value) || XObject.isObject(value);
}

const mutationMethods = ['splice', 'push', 'pop', 'sort', 'shift', 'unshift']

export function XWatch<T>(obj: T, opts: {
  onMutate?
}): T {

  function wrap(obj, path = []): any {
    return new Proxy(obj as any, {
      get(__, propName: string) {
        if (_isArray(obj) && mutationMethods.indexOf(propName) != -1) {
          return function() {
            opts.onMutate?.(propName, path, [ ...arguments ]);
            return obj[propName](...arguments);
          }
        }
        const value = obj[propName];
        if (_.isNil(value)) return value;
        if (_isArray(value) || _isObject(value)) return wrap(value, path.concat(propName));
        return value;
      },
      set(__, propName, value) {
        opts.onMutate?.('set', path.concat(propName), [ value, obj[propName] ]);
        obj[propName] = value;
        return true;
      },
      deleteProperty(__, propName) {
        opts.onMutate?.('delete', path.concat(propName));
        delete obj[propName];
        return true;
      },
    }) as any;
  }

  return wrap(obj);
}

export function XTouch(obj, path=[]) {
  if (_isArray(obj)) {
    XObject.onAccess(obj, null)

    // eslint-disable-next-line
    obj.length;
    // console.log('touch', path);
    let i = 0;
    for (const el of obj) {
      XTouch(el, path.concat(i));
      ++i;
    }
  }
  else if (_isObject(obj)) {
    XObject.onAccess(obj, null)
    for (const prop in obj) {
      // eslint-disable-next-line
      obj[prop];
      // console.log('touch', path.concat(path));
      XTouch(obj[prop], path.concat(prop));
    }
  }
}

export class XValue {
  obj: any;
  constructor(value) {
    this.obj = X({ value });
  }
  get() {
    return this.obj.value;
  }
  set(value) {
    this.obj.value = value;
  }
  observe(observer) {
    XObject.observe(this.obj, 'value', observer);
  }
}


XObject.push = function (o, prop, value) {
  if (!o[prop]) o[prop] = X([ value ]);
  else o[prop].push(value);
}

XObject.unshift = function (o, prop, value) {
  if (!o[prop]) o[prop] = X([ value ]);
  else o[prop].unshift(value);
}

export function XSet(src, target) {
  for (const prop in src) delete src[prop];
  for (const prop in target) src[prop] = target[prop];
}