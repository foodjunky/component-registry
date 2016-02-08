'use strict';

var ContainerRegistry = require('../../lib/registry');
var ContainerRegistration = require('../../lib/registration');

describe('Container Registry', function() {

  var path = __dirname + '/components';
  var config = { field: 'value' };

  var container;
  var registry;

  beforeEach(function() {
    registry = new ContainerRegistry(path, config);
  });

  afterEach(function() {
  });

  describe('constructor', function() {

    it('no paths', () => {
      expect(() => new ContainerRegistry()).to.throw(Error);
    });

    it('single path', () => {
      registry = new ContainerRegistry('one');
      expect(registry.searchPaths).to.deep.equal(['one']);
    });

    it('multiple paths', () => {
      registry = new ContainerRegistry(['one', 'two']);
      expect(registry.searchPaths).to.deep.equal(['one','two']);
    });

    it('default members', () => {
      assert(registry.config);
      assert(registry.providers);
    });

  });

  describe('load()', function() {

    it('load existing', () => {
      var module = registry.load('one');
      expect(module).to.be.a('function');
    });

    it('load missing', () => {
      expect(() => registry.load('missing')).to.throw(Error);
    });

  });

  describe('provider()', function() {
    
    var mockRegistration;

    var module = function(registration, config) {
      assert(registration instanceof ContainerRegistration);
      expect(config).to.equal(registry.config);
      // Fake registry callback to prevent provider() from exploding
      registry.providers['one'] = {};
    }

    it('create existing', () => {
      sinon.stub(registry, 'load').returns(module);
      registry.provider('one');
      expect(registry.load).to.have.callCount(1);
      registry.load.restore();
    });

    it('create missing', () => {
      sinon.stub(registry, 'load').throws(new Error('missing'));
      expect(() => registry.provider('missing')).to.throw(Error);
      registry.load.restore();
    });

  });

  describe('register()', function() {

    it('missing path', () => {
      expect(() => registry.register()).to.throw(Error);
    });

    it('missing builder', () => {
      expect(() => registry.register('test')).to.throw(Error);
    });

    it('duplicate path', () => {
      registry.providers['test'] = {};
      expect(() => registry.register('test')).to.throw(Error);
    });

    it('no dependencies', () => {
      var builder = sinon.stub().returns({});
      sinon.stub(registry, 'provider');
      registry.register('test', [ builder ]);
      expect(builder).to.have.callCount(1);
      expect(registry.provider).to.have.callCount(0);
      assert(registry.providers['test']);
      registry.provider.restore();
    });

    it('missing dependencies', function() {
      var builder = sinon.stub().returns('module');
      sinon.stub(registry, 'provider').throws(new Error('missing'));
      expect(() => registry.register('one', [ 'two', builder ])).to.throw(Error);
      registry.provider.restore();
    });

    it('circular dependencies', function() {
      var builder = sinon.stub().returns('module');
      registry.providerResolver.add('two');
      registry.providerResolver.setDependency('two', 'one');
      sinon.stub(registry, 'provider').returns('dependency');
      expect(() => registry.register('one', [ 'two', builder ])).to.throw('Circular reference detected');
      registry.provider.restore();
    });

    describe('valid dependencies', function() {
      
      var builder;

      beforeEach(() => {
        builder = sinon.stub().returns('module');
        sinon.stub(registry, 'provider').returns('dependency');
        registry.register('one', [ 'two', builder ]);
      });

      afterEach(() => {
        registry.provider.restore();
      });

      it('created dependencies', () => {
        expect(registry.provider).to.have.callCount(1);
        expect(registry.provider.args[0][0]).to.equal('two');
      });

      it('called builder with dependencies', () => {
        expect(builder).to.have.callCount(1);
        expect(builder.args[0]).to.have.length(1);
        expect(builder.args[0][0]).to.equal('dependency');
      });

    });

  });

  describe('component()', function() {

    it('not registered', () => {
      expect(() => registry.component('missing')).to.throw(Error);
    });

    it('no dependencies', () => {
      var builder = sinon.stub().returns('component');
      sinon.stub(registry, 'provider').returns({
        $get: builder
      });
      return registry.component('one').then((component) => {
        expect(registry.provider).to.have.callCount(1);
        expect(builder).to.have.callCount(1);
        expect(component).to.equal('component');
        registry.provider.restore();
      });
    });

    it('missing dependencies', function() {

      var builder = sinon.stub().returns('component');

      sinon.stub(registry, 'provider')
        .returns({ $get: ['two', builder ] })
        .withArgs('two').throws(new Error('missing'));

      return registry.component('one').then((component) => {
        assert.fail('component() should fail');
      }).catch((err) => {
        assert(err);
        expect(registry.provider).to.have.callCount(2);
        expect(registry.provider.args[0][0]).to.equal('one');
        expect(registry.provider.args[1][0]).to.equal('two');
        expect(builder).to.have.callCount(0);
        registry.provider.restore();
      });

    });

    it('circular dependencies', function() {

      var builder = sinon.stub().returns('component');

      sinon.stub(registry, 'provider').returns({ $get: ['two', builder ] });

      registry.componentResolver.add('two');
      registry.componentResolver.setDependency('two', 'one');

      expect(() => registry.component('one')).to.throw('Circular reference detected');
      registry.provider.restore();

    });

    describe('valid dependencies', function() {
      
      var one;
      var two;
      var result;

      beforeEach(() => {
        one = sinon.stub().returns('one');
        two = sinon.stub().returns('two');
        sinon.stub(registry, 'provider')
          .withArgs('one').returns({ $get: ['two', one ] })
          .withArgs('two').returns({ $get: [ two ] });
        result = registry.component('one');
      });

      afterEach(() => {
        registry.provider.restore();
      });

      it('created dependencies', () => {
        result.then((component) => {
          expect(two).to.have.callCount(1);
        });
      });

      it('called builder with dependencies', () => {
        result.then((component) => {
          expect(one).to.have.callCount(1);
          expect(one.args[0]).to.have.length(1);
          expect(one.args[0][0]).to.equal('two');
        });
      });

      it('component built', () => {
        result.then((component) => {
          expect(compoment).to.equal('one');
        });
      });

    });

  });

});