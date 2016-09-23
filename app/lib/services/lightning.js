/**
 * @file Responsible for CRUD of Lightning metadata
 * @author Joseph Ferraro <@joeferraro>
 */

'use strict';

var Promise = require('bluebird');
var _       = require('lodash');
var path    = require('path');
var logger  = require('winston');
var util    = require('../util');

// TODO: move source strings to swig templates

var LightningService = function(project){
  this.project = project;
};

LightningService.prototype.getAll = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.query('Select Id, AuraDefinitionBundleId,AuraDefinitionBundle.DeveloperName,DefType,Format FROM AuraDefinition', function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res.records);
      }
    });
  });
};

LightningService.prototype.createBundle = function(apiName, description) {
  var self = this;
  logger.debug('Creating lightning bundle: '+apiName);
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinitionBundle').create({
      Description: description, // my description
      DeveloperName: apiName, // cool_bro
      MasterLabel: apiName, // cool bro
      ApiVersion: self.project.sfdcClient.apiVersion || '32.0'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        logger.debug('Lightning bundle creation result: ');
        logger.debug(res);
        resolve(res);
      }
    });
  });
};

LightningService.prototype.deleteBundle = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinitionBundle').delete(bundleId, function(err, res) {
      if (err) {
        reject(new Error('Could not delete AuraBundle: '+err.message));
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.deleteBundleItems = function(components) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var deleteIds = [];
    _.each(components, function(c) {
      deleteIds.push(c.getLocalStoreProperties().id);
    });
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').delete(deleteIds)
      .then(function(res) {
        resolve(res);
      })
      .catch(function(err) {
        reject(err);
      });
  });
};

LightningService.prototype.getBundle = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.query('Select Id,AuraDefinitionBundleId,AuraDefinitionBundle.DeveloperName,DefType,Format FROM AuraDefinition WHERE AuraDefinitionBundleId = \''+bundleId+'\'', function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.getBundleItems = function(mavensmateFiles) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (mavensmateFiles.length === 0) {
      return resolve();
    } else {
      logger.debug('attempting to get index');
      self.project.getLightningIndex()
        .then(function(lightningIndex) {
          logger.debug('got lightning index');
          logger.debug(lightningIndex);
          var itemIds = [];
          _.each(mavensmateFiles, function(mmf) {
            var lightningBundleName = mmf.folderName; //mybundle
            var lightningType = mmf.lightningType;
            logger.debug('getting lightning type: '+lightningType);
            logger.debug('getting lightningBundleName: '+lightningBundleName);
            itemIds.push(_.find(lightningIndex, { AuraDefinitionBundle : { DeveloperName: lightningBundleName }, DefType: lightningType }).Id);
          });
          logger.debug('getting lightning components!!');
          logger.debug(itemIds);
          self.project.sfdcClient.conn.tooling.query('Select Id,AuraDefinitionBundleId,AuraDefinitionBundle.DeveloperName,DefType,Format,Source FROM AuraDefinition WHERE Id IN ('+util.joinForQuery(itemIds)+')', function(err, res) {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
        })
        .catch(function(err) {
          reject(new Error('Could not get bundle items: '+err.message));
        });
    }
  });
};

/**
 * Updates one or more lightning components
 * @param  {Array} - array of Document instances
 * @return {Promise}
 */
LightningService.prototype.update = function(components) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var updatePayload = [];
    _.each(components, function(c) {
      updatePayload.push({
        Source: c.getBodySync(),
        Id: c.getLocalStoreProperties().id
      });
    });
    logger.debug('updating lightning components', updatePayload);
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').update(updatePayload)
      .then(function(res) {
        resolve(res);
      })
      .catch(function(err) {
        reject(err);
      });
  });
};

LightningService.prototype.createComponent = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'COMPONENT',
      Format: 'XML',
      Source: '<aura:component></aura:component>'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createApplication = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'APPLICATION',
      Format: 'XML',
      Source: '<aura:application></aura:application>'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createInterface = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'INTERFACE',
      Format: 'XML',
      Source: '<aura:interface description="Interface template">\n\t<aura:attribute name="example" type="String" default="" description="An example attribute."/>\n</aura:interface>'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createDocumentation = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'DOCUMENTATION',
      Format: 'XML',
      Source: '<aura:documentation>\n\t<aura:description>Documentation</aura:description>\n\t<aura:example name="ExampleName" ref="exampleComponentName" label="Label">\n\t\tExample Description\n\t</aura:example>\n</aura:documentation>'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createController = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'CONTROLLER',
      Format: 'JS',
      Source: '({\n\tmyAction : function(component, event, helper) {\n\t}\n})'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createRenderer = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'RENDERER',
      Format: 'JS',
      Source: '({\n\t// Your renderer method overrides go here\n})'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createHelper = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'HELPER',
      Format: 'JS',
      Source: '({\n\thelperMethod : function() {\n\t}\n})'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createStyle = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'STYLE',
      Format: 'CSS',
      Source: '.THIS {\n}'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createDesign = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    logger.warn('creating design', bundleId);
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'DESIGN',
      Format: 'XML',
      Source: '<design:component>\n\n</design:component>'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createSvg = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'SVG',
      Format: 'SVG',
      Source: '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg width="120px" height="120px" viewBox="0 0 120 120" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n</svg>'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

LightningService.prototype.createEvent = function(bundleId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.conn.tooling.sobject('AuraDefinition').create({
      AuraDefinitionBundleId: bundleId,
      DefType: 'EVENT',
      Format: 'XML',
      Source: '<aura:event type="APPLICATION" description="Event template" />'
    }, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

module.exports = LightningService;