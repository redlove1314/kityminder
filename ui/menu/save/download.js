/**
 * @fileOverview
 *
 * 导出数据到本地
 *
 * @author: techird
 * @copyright: Baidu FEX, 2014
 */
KityMinder.registerUI('menu/save/download', function(minder) {
    var $menu = minder.getUI('menu/menu');
    var $save = minder.getUI('menu/save/save');

    /* 导出面板 */
    var $panel = $($save.createSub('download')).addClass('download-panel');

    /* 标题 */
    var $title = $('<h2></h2>')
        .text(minder.getLang('ui.menu.downloadheader'))
        .appendTo($panel);

    var $list = $('<ul>')
        .addClass('download-list')
        .appendTo($panel);

    var supports = [];

    minder.getSupportedProtocols().forEach(function(protocol) {
        if (protocol.encode) {
            supports.push(protocol);
        }
    });

    supports.forEach(function(protocol) {
        $('<li>')
            .addClass(protocol.name)
            .text(protocol.fileDescription + ' (' + protocol.fileExtension + ')')
            .data('protocol', protocol)
            .appendTo($list);
    });

    $list.delegate('li', 'click', function(e) {
        var protocol = $(e.target).data('protocol');
        if (!$panel.hasClass('loading')) doExport(protocol);
    });

    function doExport(protocol) {
        var filename = minder.getMinderTitle() + protocol.fileExtension;
        var mineType = protocol.mineType || 'text/plain';

        $panel.addClass('loading');

        var options = {
            download: true,
            filename: filename
        };

        minder.exportData(protocol.name, options).then(function(data) {

            if (protocol.name == 'freemind') return;

            switch (protocol.dataType) {
                case 'text':
                    return doDownload(buildDataUrl(mineType, data), filename, 'text');
                case 'base64':
                    return doDownload(data, filename, 'base64');
                case 'blob':
                    return null;
            }

            return null;

        })['catch'](function exportError(e) {
            var notice = minder.getUI('widget/notice');
            return notice.error('err_download', e);
        })

        .then(function done(tick) {
            $panel.removeClass('loading');
        });
    }
    function doDownload(url, filename, type) {
        var content = url.split(',')[1];
        var data;

        if (type == 'base64') {
            data = atob(decodeURIComponent(content));
        } else {
            data = decodeURIComponent(content);
        }

        var blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
        var downloadUrl = URL.createObjectURL(blob);

        var link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(function() {
            URL.revokeObjectURL(downloadUrl);
        }, 100);

        return Promise.resolve();
    }

    function buildDataUrl(mineType, data) {
        return 'data:' + mineType + '; utf-8,' + encodeURIComponent(data);
    }
});