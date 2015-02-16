'use strict';

var mod = angular.module('drupalService', ['ngResource']);

mod.hal = {
    fromServer: function (hal) {
        var internals = hal._internals = {};

        // Inject the nid (last element from href
        var nid = hal._links.self.href.split(/\//).pop();
        internals.nid = [{value: nid, _drupal: 'https://www.drupal.org/node/2304849'}];

        // Transform _links into node fields
        angular.forEach(hal._links, function (value, key) {
            if (key === 'self') {
                return;
            }
            if (key === 'type') {
                return;
            }
            var id = key.split(/\//).pop();
            internals[id] = [];
            angular.forEach(value, function (val, index) {
                internals[id].push({target_id: val.href.split(/\//).pop()});
            });
        });

    },
    toServer: function (hal) {
        if (hal) {
            delete hal._internals;
        }
    }
};

mod.drupal = {
    /**
     * Transform Headers depending on mode
     *
     * @param string mode
     *   hal | json
     * @param data
     * @param headerGetter
     */
    transformRequest: function (data, headersGetter, mode, user) {
        if (mode == 'hal') {
            headersGetter().Accept = 'application/hal+json';

            if (user) {
                console.log(user);
                if (user.token) {
                    headersGetter()['X-CSRF-Token'] = user.token;
                }
            }

            mod.hal.toServer(data);
        }
        return angular.toJson(data);
    }
};

mod
    .factory('Node', ['SERVER', 'DRUPAL', '$resource', 'DrupalState', function (SERVER, DRUPAL, $resource, DrupalState) {
        return $resource('/node/:nid', {nid: '@nid'}, {

            query: {
                method: 'GET',
                url: SERVER.URL + '/node',
                isArray: true,
                transformRequest: function (data, headersGetter) {
                    return mod.drupal.transformRequest(data, headersGetter, DRUPAL.MODE);
                },
                transformResponse: function (data, headersGetter) {
                    var json = angular.fromJson(data);
                    angular.forEach(json, function (node, index) {
                        mod.hal.fromServer(node);
                    });
                    return json;
                }
            },
            fetch: {
                method: 'GET',
                url: SERVER.URL + '/node/:nid',
                transformRequest: function (data, headersGetter) {
                    return mod.drupal.transformRequest(data, headersGetter, DRUPAL.MODE);
                },
                transformResponse: function (data, headersGetter) {
                    var node = angular.fromJson(data);
                    mod.hal.fromServer(node);
                    return node;
                }

            },

            patch: {
                method: 'PATCH',
                url: SERVER.URL + '/node/:nid',
                transformRequest: function (data, headersGetter) {
                    return mod.drupal.transformRequest(data, headersGetter, DRUPAL.MODE);
                }
            },

            create: {
                method: 'POST',
                url: SERVER.URL + '/entity/node',
                transformRequest: function (data, headersGetter) {
                    return mod.drupal.transformRequest(data, headersGetter, DRUPAL.MODE, DrupalState.get('user'));
                },
                transformResponse: function (data, headersGetter) {
                    console.log('transformResponse', data);
                }
            }
        });
    }])

    .factory('NodeByTerm', ['SERVER', '$resource', function (SERVER, $resource) {
        return $resource(SERVER.URL + '/taxonomy/term/:tid', {tid: '@tid'}, {});
    }])

    .factory('TaxonomyTerm', ['SERVER', '$resource', function (SERVER, $resource) {
        return $resource(SERVER.URL + '/taxonomy/list/:tid', {tid: '@tid'}, {
            'fetch': {
                method: 'GET',
                //transformRequest: function (data, headersGetter) {
                //    headersGetter().Accept = 'application/hal+json';
                //    headersGetter()['Content-Type'] = 'application/hal+json';
                //}
                transformResponse: function (data, headersGetter) {
                    var json = angular.fromJson(data);
                    var hash = {};
                    angular.forEach(json, function (item) {
                        hash[item.tid] = item;
                    });
                    return hash;
                }
            }
        });
    }])

    .factory('User', ['SERVER', '$resource', function (SERVER, $resource) {
        return $resource(SERVER.URL + '/user/:uid', {uid: '@uid'}, {});
    }])

    .factory('Comment', ['SERVER', '$resource', function (SERVER, $resource) {
        return $resource(SERVER.URL + '/node/:nid/comments', {nid: '@nid'}, {
            'post': {
                method: 'POST',
                url: '/entity/comment',
                transformRequest: function (data, headersGetter) {
                    return mod.drupal.transformRequest(data, headersGetter, DRUPAL.MODE, DrupalState.get('user'));
                }
            }
        });
    }])

    .factory('Token', ['SERVER', '$resource', function (SERVER, $resource) {
        return $resource(SERVER.URL + '/rest/session/token', {}, {
            fetch: {
                method: 'GET',
                transformResponse: function (data, headersGetter) {
                    return {token: data};
                }
            }
        })
    }])

    .factory('DrupalState', function (CacheService) {
        var cache = {
            get: function (key) {
                var item = CacheService.get(key);

                if (item) {
                    return item;
                }

                return null;
            },
            set: function (key, value) {
                CacheService.put(key, value);
            },
            clear: function (key) {
                CacheService.put(key, '');
            }
        };
        cache.set('user', {username: null, password: null, authenticated: false});
        cache.set('X-CSRF-Token', null);

        return cache;
    }
);
