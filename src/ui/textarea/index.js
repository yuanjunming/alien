/**
 * 文件描述
 * @author ydr.me
 * @create 2015-12-23 17:31
 */


define(function (require, exports, module) {
    /**
     * @module parent/index
     */

    'use strict';

    var ui = require('../index.js');
    var selector = require('../../core/dom/selector.js');
    var event = require('../../core/event/hotkey.js');
    var textarea = require('../../utils/textarea.js');
    var controller = require('../../utils/controller.js');
    var dato = require('../../utils/dato.js');

    var defaults = {
        tabSize: 4,
        historyLength: 99
    };

    var Textarea = ui.create({
        constructor: function ($textarea, options) {
            var the = this;

            the._$textarea = selector.query($textarea)[0];
            the._options = dato.extend({}, defaults, options);
            the._stack = [];
            the._set(0, 0, the._$textarea.value);
            the._initEvent();
        },


        /**
         * 初始化事件
         * @private
         */
        _initEvent: function () {
            var the = this;

            the.bind('tab', function () {
                the.increaseIndent();
                return false;
            });

            the.bind('shift+tab', function () {
                the.decreaseIndent();
                return false;
            });

            the.bind('cmd+z ctrl+z', function () {
                the._get();
                return false;
            });

            the.bind('cmd+shift+z ctrl+shift+z', function () {
                the._get(true);
                return false;
            });

            the.bind('input', controller.debounce(function () {
                var selection = the.getSelection();

                the._set(selection[0], selection[1], this.value);
            }));
        },


        /**
         * 绑定事件
         * @param eventType
         * @param callback
         * @returns {Textarea}
         */
        bind: function (eventType, callback) {
            var the = this;
            event.on(the._$textarea, eventType, callback);
            return the;
        },


        /**
         * 增加缩进
         * @returns {Textarea}
         */
        increaseIndent: function () {
            var the = this;
            var selection = the.getSelection();
            var lines = the.getLines();
            var $textarea = the._$textarea;
            var value = $textarea.value;
            var options = the._options;
            var tabSize = options.tabSize;
            var tabValue = new Array(options.tabSize + 1).join(' ');

            dato.each(lines, function (index, item) {
                var left = value.slice(0, item.start + index * tabSize);
                var right = value.slice(item.end + index * tabSize);

                value = left + tabValue + item.text + right;
            });

            var start = selection[0] + tabSize;
            var end = selection[1] + tabSize * lines.length;
            the._set(start, end, value);

            return the;
        },


        /**
         * 减少缩进
         * @returns {Textarea}
         */
        decreaseIndent: function () {
            var the = this;
            var selection = the.getSelection();
            var lines = the.getLines();
            var $textarea = the._$textarea;
            var value = $textarea.value;
            var options = the._options;
            var tabSize = options.tabSize;
            var regTab = new RegExp('^\\s{' + tabSize + '}');
            var tabLineLength = 0;
            var isTabFirstLine = false;

            dato.each(lines, function (index, item) {
                // has tab
                if (regTab.test(item.text)) {
                    if (!isTabFirstLine) {
                        isTabFirstLine = index === 0;
                    }

                    var left = value.slice(0, item.start - tabLineLength * tabSize);
                    var right = value.slice(item.end - tabLineLength * tabSize);
                    var text = item.text.slice(tabSize);

                    tabLineLength++;
                    value = left + text + right;
                }
            });

            var start = selection[0] - (isTabFirstLine ? tabSize : 0);
            var end = selection[1] - tabLineLength * tabSize;
            the._set(start, end, value);

            return the;
        },


        /**
         * 获取当前选中的行信息
         * @param [start]
         * @param [end]
         * @returns {Array}
         */
        getLines: function (start, end) {
            var the = this;
            var $textarea = the._$textarea;
            var selection = the.getSelection();
            start = start || selection[0];
            end = end || selection[1];
            var value = $textarea.value;
            var lines = value.split('\n');
            var ret = [];
            var lineEnd = 0;
            var inSelection = false;

            dato.each(lines, function (index, value) {
                if (index) {
                    lineEnd += 1;
                }

                var lineStart = lineEnd;
                lineEnd += value.length;
                var item = {
                    start: lineStart,
                    end: lineEnd,
                    text: value
                };

                if (inSelection && lineStart > end) {
                    return false;
                }
                // first line
                else if (!inSelection && lineEnd >= start) {
                    inSelection = true;
                    ret.push(item);
                }
                // middle inline
                else if (inSelection && lineStart >= start && lineEnd <= end) {
                    ret.push(item);
                }
                // last line
                else if (inSelection && lineEnd >= end) {
                    ret.push(item);
                }
            });

            return ret;
        },


        /**
         * 返回当前选区
         * @returns {Number|Number[]}
         */
        getSelection: function () {
            return textarea.getSelection(this._$textarea);
        },


        /**
         * 设置选区
         * @param start
         * @param end
         * @returns {Textarea}
         */
        setSelection: function (start, end) {
            var the = this;

            textarea.setSelection(the._$textarea, start, end);

            return the;
        },


        /**
         * 聚焦
         * @returns {Textarea}
         */
        focus: function () {
            var the = this;

            the._$textarea.focus();

            return the;
        },


        /**
         * 失焦
         * @returns {Textarea}
         */
        blur: function () {
            var the = this;

            the._$textarea.blur();

            return the;
        },


        /**
         * 入栈
         * @param start
         * @param end
         * @param value
         * @private
         */
        _set: function (start, end, value) {
            var the = this;
            var $textarea = the._$textarea;

            if (the._stackIndex > 1) {
                the._stack.splice(0, the._stackIndex - 1);
            }

            the._stackIndex = 0;
            $textarea.value = value;
            var item = {
                start: start,
                end: end,
                value: value
            };
            the._stack.unshift(item);
            textarea.setSelection($textarea, start, end);
            the.emit('change', item);

            while (the._stack.length > the._options.historyLength) {
                the._stack.pop();
            }
        },


        /**
         * 取栈
         * @private
         * @param [forward] {Boolean} 是否前进
         */
        _get: function (forward) {
            var the = this;
            var maxIndex = the._stack.length - 1;

            the._stackIndex += forward ? -1 : 1;

            if (the._stackIndex > maxIndex) {
                the._stackIndex = maxIndex;
                return;
            } else if (the._stackIndex < 0) {
                the._stackIndex = 0;
                return;
            }

            var point = the._stack[the._stackIndex];
            var $textarea = the._$textarea;
            $textarea.value = point.value;
            textarea.setSelection($textarea, point.start, point.end);
        }
    });

    Textarea.defaults = defaults;
    module.exports = Textarea;
});