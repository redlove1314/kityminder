/* global zip:true */
/*
    http://www.xmind.net/developer/
    Parsing XMind file
    XMind files are generated in XMind Workbook (.xmind) format, an open format
    that is based on the principles of OpenDocument. It consists of a ZIP
    compressed archive containing separate XML documents for content and styles,
    a .jpg image file for thumbnails, and directories for related attachments.
 */
KityMinder.registerProtocol('xmind', function(minder) {

    // 标签 map
    var markerMap = {
        'priority-1': ['priority', 1],
        'priority-2': ['priority', 2],
        'priority-3': ['priority', 3],
        'priority-4': ['priority', 4],
        'priority-5': ['priority', 5],
        'priority-6': ['priority', 6],
        'priority-7': ['priority', 7],
        'priority-8': ['priority', 8],

        'task-start': ['progress', 1],
        'task-oct': ['progress', 2],
        'task-quarter': ['progress', 3],
        'task-3oct': ['progress', 4],
        'task-half': ['progress', 5],
        'task-5oct': ['progress', 6],
        'task-3quar': ['progress', 7],
        'task-7oct': ['progress', 8],
        'task-done': ['progress', 9]
    };

    return {
        fileDescription: 'XMind 格式',
        fileExtension: '.xmind',
        dataType: 'blob',
        mineType: 'application/octet-stream',

        decode: function(local) {

            function processTopic(topic, obj) {

                //处理文本
                obj.data = {
                    text: topic.title
                };

                // 处理标签
                if (topic.marker_refs && topic.marker_refs.marker_ref) {
                    var markers = topic.marker_refs.marker_ref;
                    var type;
                    if (markers.length && markers.length > 0) {
                        for (var i in markers) {
                            type = markerMap[markers[i].marker_id];
                            if (type) obj.data[type[0]] = type[1];
                        }
                    } else {
                        type = markerMap[markers.marker_id];
                        if (type) obj.data[type[0]] = type[1];
                    }
                }

                // 处理超链接
                if (topic['xlink:href']) {
                    obj.data.hyperlink = topic['xlink:href'];
                }
                //处理子节点
                var topics = topic.children && topic.children.topics;
                var subTopics = topics && (topics.topic || topics[0] && topics[0].topic);
                if (subTopics) {
                    var tmp = subTopics;
                    if (tmp.length && tmp.length > 0) { //多个子节点
                        obj.children = [];

                        for (var i in tmp) {
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
                var sheet = json.sheet;
                var topic = utils.isArray(sheet) ? sheet[0].topic : sheet.topic;
                processTopic(topic, result);
                return result;
            }

            function getEntries(file, onend) {
                return new Promise(function(resolve, reject) {                    
                    zip.createReader(new zip.BlobReader(file), function(zipReader) {
                        zipReader.getEntries(resolve);
                    }, reject);
                });
            }

            function readDocument(entries) {
                return new Promise(function(resolve, reject) {
                    var entry, json;

                    // 查找文档入口
                    while ((entry = entries.pop())) {

                        if (entry.filename.split('/').pop() == 'content.xml') break;

                        entry = null;

                    }

                    // 找到了读取数据
                    if (entry) {

                        entry.getData(new zip.TextWriter(), function(text) {
                            try {
                                json = xml2km($.parseXML(text));
                                resolve(json);
                            } catch (e) {
                                reject(e);
                            }
                        });

                    } 

                    // 找不到返回失败
                    else {
                        reject(new Error('Content document missing'));
                    }
                });
            }

            return getEntries(local).then(readDocument);

        },

        encode: function(json, km, options) {
            var timestamp = Date.now();
            var id = 'id_' + Math.random().toString(36).substr(2, 9);
            
            function escapeXml(str) {
                return str.replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/"/g, '&quot;')
                          .replace(/'/g, '&apos;');
            }
            
            function buildTopic(node, isRoot) {
                var xml = '<topic id="' + id + '" ';
                if (isRoot) {
                    xml += 'structure-class="org.xmind.ui.map.clockwise" ';
                }
                xml += 'timestamp="' + timestamp + '">\n';
                
                if (node.data && node.data.text) {
                    xml += '    <title>' + escapeXml(node.data.text) + '</title>\n';
                }
                
                if (node.data && (node.data.priority || node.data.progress)) {
                    xml += '    <marker-refs>\n';
                    if (node.data.priority) {
                        xml += '        <marker-ref marker-id="priority-' + node.data.priority + '"/>\n';
                    }
                    if (node.data.progress) {
                        var progressMap = {
                            1: 'task-start',
                            2: 'task-oct',
                            3: 'task-quarter',
                            4: 'task-3oct',
                            5: 'task-half',
                            6: 'task-5oct',
                            7: 'task-3quar',
                            8: 'task-7oct',
                            9: 'task-done'
                        };
                        xml += '        <marker-ref marker-id="' + progressMap[node.data.progress] + '"/>\n';
                    }
                    xml += '    </marker-refs>\n';
                }
                
                if (node.children && node.children.length > 0) {
                    xml += '    <children>\n';
                    xml += '        <topics type="attached">\n';
                    node.children.forEach(function(child) {
                        xml += buildTopic(child, false);
                    });
                    xml += '        </topics>\n';
                    xml += '    </children>\n';
                }
                
                if (node.data && node.data.resource) {
                    xml += '    <labels>\n';
                    xml += '        <label>' + escapeXml(node.data.resource) + '</label>\n';
                    xml += '    </labels>\n';
                }
                
                xml += '</topic>\n';
                return xml;
            }
            
            function buildContentXml() {
                return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
                       '<xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" timestamp="' + timestamp + '" version="2.0">\n' +
                       '    <sheet id="' + id + '" timestamp="' + timestamp + '">\n' +
                       buildTopic(json, true) +
                       '        <title>画布 1</title>\n' +
                       '    </sheet>\n' +
                       '</xmap-content>\n';
            }
            
            function buildMetaXml() {
                return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
                       '<xmap-meta xmlns="urn:xmind:xmap:xmlns:meta:2.0" xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" version="2.0">\n' +
                       '    <Creator>\n' +
                       '        <Name>KityMinder</Name>\n' +
                       '        <Version>1.0</Version>\n' +
                       '    </Creator>\n' +
                       '    <Author>\n' +
                       '        <Name>User</Name>\n' +
                       '    </Author>\n' +
                       '    <LastModified>' + timestamp + '</LastModified>\n' +
                       '</xmap-meta>\n';
            }
            
            function buildManifestXml() {
                return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
                       '<manifest xmlns="urn:xmind:xmap:xmlns:manifest:1.0">\n' +
                       '    <file-entry full-path="content.xml" media-type="text/xml"/>\n' +
                       '    <file-entry full-path="META-INF/" media-type=""/>\n' +
                       '    <file-entry full-path="META-INF/manifest.xml" media-type="text/xml"/>\n' +
                       '    <file-entry full-path="meta.xml" media-type="text/xml"/>\n' +
                       '    <file-entry full-path="Revisions/" media-type=""/>\n' +
                       '    <file-entry full-path="Revisions/' + id + '/" media-type=""/>\n' +
                       '    <file-entry full-path="Revisions/' + id + '/rev-1-' + timestamp + '.xml" media-type=""/>\n' +
                       '    <file-entry full-path="Revisions/' + id + '/revisions.xml" media-type=""/>\n' +
                       '    <file-entry full-path="Thumbnails/" media-type=""/>\n' +
                       '    <file-entry full-path="Thumbnails/thumbnail.png" media-type="image/png"/>\n' +
                       '</manifest>\n';
            }
            
            function buildRevisionXml() {
                return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
                       '<revisions xmlns="urn:xmind:xmap:xmlns:revisions:2.0">\n' +
                       '    <revision id="rev-1-' + timestamp + '" timestamp="' + timestamp + '"/>\n' +
                       '</revisions>\n';
            }
            
            function buildRevXml() {
                return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
                       '<rev xmlns="urn:xmind:xmap:xmlns:rev:2.0">\n' +
                       '    <sheet id="' + id + '"/>\n' +
                       '    <creator>KityMinder</creator>\n' +
                       '    <timestamp>' + timestamp + '</timestamp>\n' +
                       '</rev>\n';
            }
            
            function buildMetaManifestXml() {
                return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
                       '<manifest xmlns="urn:xmind:xmap:xmlns:manifest:1.0">\n' +
                       '    <file-entry full-path="meta.xml" media-type="text/xml"/>\n' +
                       '</manifest>\n';
            }
            
            function createThumbnail() {
                var canvas = document.createElement('canvas');
                canvas.width = 200;
                canvas.height = 150;
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, 200, 150);
                ctx.fillStyle = '#000000';
                ctx.font = '16px Arial';
                ctx.fillText('KityMinder', 60, 80);
                return canvas.toDataURL('image/png').split(',')[1];
            }
            
            return new Promise(function(resolve, reject) {
                if (typeof JSZip === 'undefined') {
                    reject(new Error('JSZip library not loaded'));
                    return;
                }
                
                var zip = new JSZip();
                
                zip.file('content.xml', buildContentXml());
                zip.file('meta.xml', buildMetaXml());
                zip.file('META-INF/manifest.xml', buildMetaManifestXml());
                zip.file('manifest.xml', buildManifestXml());
                zip.file('Revisions/' + id + '/revisions.xml', buildRevisionXml());
                zip.file('Revisions/' + id + '/rev-1-' + timestamp + '.xml', buildRevXml());
                zip.file('Thumbnails/thumbnail.png', createThumbnail(), { base64: true });
                
                zip.generateAsync({ type: 'blob' }).then(function(content) {
                    resolve(content);
                }).catch(reject);
            });
        },

        // recognize: recognize,
        recognizePriority: -1
    };

});