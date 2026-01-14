/**
 * @fileOverview FreeMind 文件格式支持
 *
 * Freemind 文件后缀为 .mm，实际上是一个 XML 文件
 * @see http://freemind.sourceforge.net/
 */

KityMinder.registerProtocol('freemind', function(minder) {

    // 标签 map
    var markerMap = {
        'full-1': ['priority', 1],
        'full-2': ['priority', 2],
        'full-3': ['priority', 3],
        'full-4': ['priority', 4],
        'full-5': ['priority', 5],
        'full-6': ['priority', 6],
        'full-7': ['priority', 7],
        'full-8': ['priority', 8]
    };

    function processTopic(topic, obj) {

        //处理文本
        obj.data = {
            text: topic.TEXT
        };
        var i;

        // 处理标签
        if (topic.icon) {
            var icons = topic.icon;
            var type;
            if (icons.length && icons.length > 0) {
                for (i in icons) {
                    type = markerMap[icons[i].BUILTIN];
                    if (type) obj.data[type[0]] = type[1];
                }
            } else {
                type = markerMap[icons.BUILTIN];
                if (type) obj.data[type[0]] = type[1];
            }
        }

        // 处理超链接
        if (topic.LINK) {
            obj.data.hyperlink = topic.LINK;
        }

        //处理子节点
        if (topic.node) {

            var tmp = topic.node;
            if (tmp.length && tmp.length > 0) { //多个子节点
                obj.children = [];

                for (i in tmp) {
                    obj.children.push({});
                    processTopic(tmp[i], obj.children[i]);
                }

            } else { //一个子节点
                obj.children = [{}];
                processTopic(tmp, obj.children[0]);
            }
        }
    }

    function xml2km(xml) {
        var json = $.xml2json(xml);
        var result = {};
        processTopic(json.node, result);
        return result;
    }

    function km2xml(json) {
        var timestamp = Date.now();
        var id = 'ID_' + Math.random().toString(36).substr(2, 9);
        
        function buildNode(node, isRoot) {
            var attrs = [];
            attrs.push('CREATED="' + timestamp + '"');
            attrs.push('ID="' + id + '"');
            attrs.push('MODIFIED="' + timestamp + '"');
            
            if (node.data && node.data.text) {
                attrs.push('TEXT="' + escapeXml(node.data.text) + '"');
            }
            
            if (isRoot && node.data && node.data.position) {
                attrs.push('POSITION="' + node.data.position + '"');
            }
            
            var xml = '<node ' + attrs.join(' ') + '>';
            
            if (node.data && node.data.priority) {
                xml += '<icon BUILTIN="full-' + node.data.priority + '"/>';
            }
            
            if (node.children) {
                node.children.forEach(function(child) {
                    xml += buildNode(child, false);
                });
            }
            
            xml += '</node>';
            return xml;
        }
        
        return '<map version="1.0.1">\n<!-- To view this file, download free mind mapping software FreeMind from http://freemind.sourceforge.net -->\n' + buildNode(json, true) + '\n</map>';
    }
    
    function escapeXml(str) {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&apos;');
    }

    return {
        fileDescription: 'Freemind 格式',
        fileExtension: '.mm',
        mineType: 'application/xml',
        dataType: 'text',

        decode: function(local) {
            return new Promise(function(resolve, reject) {
                try {
                    resolve(xml2km(local));
                } catch (e) {
                    reject(new Error('XML 文件损坏！'));
                }
            });
        },

        encode: function(json, km, options) {
            return Promise.resolve(km2xml(json));
        }
    };

});