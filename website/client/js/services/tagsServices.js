'use strict';

angular.module('habitrpg')
.factory('Tags',  ['$rootScope', '$http',
  function tagsFactory($rootScope, $http) {

    function getTags () {
      return $http({
        method: 'GET',
        url: 'api/v3/tags',
      });
    };

    function createTag (tagDetails) {
      return $http({
        method: 'POST',
        url: 'api/v3/tags',
        data: tagDetails,
      });
    };

    function getTag (tagId) {
      return $http({
        method: 'GET',
        url: 'api/v3/tags/' + tagId,
      });
    };

    function updateTag (tagId, tagDetails) {
      return $http({
        method: 'PUT',
        url: 'api/v3/tags/' + tagId,
        data: tagDetails,
      });
    };

    function updateTags (tags) {
      return $http({
        method: 'PUT',
        url: 'api/v3/tags',
        data: {tags: tags},
      });
    };

    function deleteTag (tagId) {
      return $http({
        method: 'DELETE',
        url: 'api/v3/tags/' + tagId,
      });
    };

    return {
      getTags: getTags,
      createTag: createTag,
      getTag: getTag,
      updateTag: updateTag,
      updateTags: updateTags,
      deleteTag: deleteTag,
    };
  }]);
