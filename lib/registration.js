/*
 * A component registration proxy. When a loadable module is initialized, it is
 * passed an instance of ContainerRegistration, which allows the module to register
 * one or more component, factory or provider methods.
 *
 * See regitry.js for more details on creating loadable component modules.
 */
'use strict'

import _ from 'lodash';

export default class ContainerRegistration {

  constructor(registry, path) {
    this.registry = registry;
    this.path = path;
  }

  decorate(builder, type, decorator) {

    builder = this.normalize(builder, type);

    return decorator ?
      decorator(builder) :
      builder;

  }

  normalize(builder, type) {

    if (_.isFunction(builder)) {
      builder = [builder];
    } 

    if (!Array.isArray(builder)) {
      throw new Error(type + ' must be a function, optionally as an array prefixed by dependencies');
    }

    if (!_.isFunction(builder[builder.length - 1])) {
      throw new Error(type + ' must be a function, optionally as an array prefixed by dependencies');
    }

    return builder;

  }

  /*
   * Register a factory provider with the container. This provides
   * additional control over factory configuration, since it has access
   * to other providers during instantiation.
   */
  provider(provider) {
    this.registry.register(this.path, this.normalize(provider, 'Provider'));
  }

  /*
   * Register a component factory with the container. This method allows
   * more control over component creation than the component() method, allowing
   * multiple instances of a component to be created (or one per injection)
   * if desired.
   */
  factory(factory) {

    factory = this.normalize(factory, 'Factory');

    this.registry.register(this.path, [/* no dependencies */ function() {
      return {
        $get: factory
      };
    }]);

  }

  /*
   * Register a singleton component with the container.
   */
  component(factory) {

    factory = this.normalize(factory, 'Component');

    var instance;

    // Save actual builder
    var builder = factory.pop();

    // Replace builder with proxy for instance caching
    factory.push(function() {

      if (instance) {
        return Promise.resolve(instance);
      }

      return Promise.resolve(builder.apply(null, arguments)).then((component) => {
        instance = component;
        return component;
      });

    });

    this.registry.register(this.path, [/* no dependencies */ function() {
      return {
        $get: factory
      };
    }]);

  }

}