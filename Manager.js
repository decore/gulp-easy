import _ from 'lodash';
import glob from 'glob';
import gulp from 'gulp';
import yargs from 'yargs';

// Tasks
import Files from './task/Files';
import Less from './task/Less';
import Js from './task/Js';
import Inline from './task/Inline';

export default class Manager {

    /**
     *
     * @param g
     */
    constructor(g) {
         this._config = {
            dest: 'public',
            name: 'app',
            compress: null,
            watch: null
        };

        this._names = [];
        this._nameIndexes = {};
        this._tasks = [];
        this._isProduction = !!yargs.argv.production || yargs.argv._.indexOf('production') !== -1;

        this._gulp = g || gulp;
        this._gulp.task('default', this._tasks);
        this._gulp.task('production', this._tasks);

        // Do not exit on exceptions
        if (!this._isProduction) {
            process.on('uncaughtException', function(e) {
                console.error(e.stack || String(e));
            });
        }
    }

    /**
     *
     * @param {object} config
     * @returns {self}
     */
    config(config) {
        _.merge(this._config, config);
        return this;
    }

    isWatch() {
        return this._config.watch !== null ? this._config.watch : !this._isProduction;
    }

    isCompress() {
        return this._config.compress !== null ? this._config.compress : this._isProduction;
    }

    /**
     *
     * @param {string|string[]} src
     * @param {string} [dest] Path to destination file
     * @param {object} [config]
     * @returns {self}
     */
    files(src, dest, config) {
        var task = new Files();
        task.src = this._normalizeSrc(src);
        task.dest = this._parseDest(dest, !dest.match(/\/$/));
        task.config = _.merge(task.config, this._config.files || {}, config || {});
        task.name = this._getTaskName(task.dest.name + '_files');
        this._runTask(task);

        return this;
    }

    /**
     *
     * @param {string|string[]} src
     * @param {string} [dest] Path to destination file
     * @param {object} [config]
     * @returns {self}
     */
    less(src, dest, config) {
        var task = new Less();
        task.src = this._normalizeSrc(src);
        task.dest = this._parseDest(dest, true, 'css');
        task.config = _.merge(task.config, this._config.less || {}, config || {});
        task.name = this._getTaskName(task.dest.name + '_css');
        this._runTask(task);

        return this;
    }

    /**
     *
     * @param {string|string[]} src
     * @param {string} [dest] Path to destination file
     * @param {object} [config]
     * @returns {self}
     */
    js(src, dest, config) {
        var task = new Js();
        task.src = this._normalizeSrc(src);
        task.dest = this._parseDest(dest, true, 'js');
        task.config = _.merge(task.config, this._config.js || {}, config || {});
        task.name = this._getTaskName(task.dest.name + '_js');
        this._runTask(task);

        return this;
    }

    /**
     *
     * @param {function} taskHandler
     * @param {function} [watchHandler]
     * @returns {self}
     */
    task(taskHandler, watchHandler) {
        var task = new Inline();
        task.taskHandler = taskHandler;
        task.watchHandler = watchHandler || null;
        task.name = this._getTaskName('task');
        this._runTask(task);

        return this;
    }

    _getTaskName(name) {
        name = '_' + name;
        if (this._names.indexOf(name) !== -1) {
            if (name.match(/[0-9]$/)) {
                name = name.replace(/[0-9]+$/, function(num) { return parseInt(num) + 1 });
            } else {
                name = name + '2';
            }
        }

        this._names.push(name);
        return name;
    }

    _runTask(task) {
        task.manager = this;
        task.gulp = this._gulp;
        task.init();

        this._tasks.push(task.name);
        this._gulp.task(task.name, task.run.bind(task));
        if (this.isWatch()) {
            task.watch();
        }
    }

    _generateName(group) {
        if (!this._nameIndexes[group]) {
            this._nameIndexes[group] = 0;
        }
        this._nameIndexes[group]++;
        return this._config.name + (this._nameIndexes[group] > 1 ? this._nameIndexes[group] : '');
    }

    _parseDest(dest, isFile, group) {
        dest = dest || '';

        if (isFile) {
            var matchFile = /\/?([^\/]+)$/.exec(dest);
            var file = matchFile !== null ? matchFile[1] : this._generateName(group);
            var dir = dest.replace(/\/?[^\/]*$/, '');
            if (!dir) {
                dir = this._config.dest;
            }

            var matchExt = /\.([^\.]+)$/.exec(file);
            var ext = matchExt !== null ? matchExt[1] : '';
            return {
                dir: dir,
                file: file,
                name: ext ? file.substr(0, file.length - ext.length - 1) : file,
                ext: ext
            };
        } else {
            var matchName = /\/?([^\/]+)$/.exec(dest);
            return {
                dir: dest.replace('/\/$/', ''),
                file: '',
                name: matchName !== null ? matchName[1] : this._generateName(group),
                ext: ''
            };
        }
    }

    _normalizeSrc(src) {
        if (!_.isArray(src)) {
            src = [src];
        }

        var files = [];
        _.each(src, function(path) {
            files = files.concat(glob.sync(path, {cwd: process.cwd(), root: '/'}));
        });

        return files;
    }

}
