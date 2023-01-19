/**
 * Created by Ab on 18-12-2015.
 */

var gulp = require('gulp');
var del = require('del');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var merge = require('merge2');
var addsrc = require('gulp-add-src');
var ts = require('gulp-typescript');
var tslint = require('gulp-tslint');
var sourcemaps = require('gulp-sourcemaps');
var mocha = require('gulp-spawn-mocha');

var node_red_root = process.env.NODE_RED_ROOT;

// swallow errors in watch
function swallowError (error) {

  //If you want details of the error in the console
  console.log(error.toString());

  this.emit('end');
}

//define typescript project
var tsProject = ts.createProject({
  module: 'commonjs',
  target: 'ES5',
  declaration: true
});

gulp.task('clean', async function () {
  del([
    'lib',
    'coverage',
    'transpiled'
  ]);
});

gulp.task('clean:all', gulp.series(['clean', async function () {
  del(['node_modules']);
}]));


function compile() {
  // compile typescript
  var tsResult = gulp.src('src/**/*.ts')
    .pipe(tslint({
      configuration: 'tools/tslint/tslint-node.json'
    }))
    .pipe(tslint.report())
    .pipe(addsrc.prepend('typings*/**/*.d.ts'))
    // .pipe (sourcemaps.init())
    .pipe (tsProject());

  // return merge([
  //   tsResult.js
  //     .pipe(sourcemaps.write('.', {
  //       includeContent: false,
  //       sourceRoot: '../src/'
  //     }))
  //     .pipe(gulp.dest('transpiled')),
  //   tsResult.dts.pipe(gulp.dest('transpiled'))
  // ]);
  return tsResult.js.pipe(gulp.dest('transpiled'));
}
gulp.task('compile', compile);

function lint() {
  return gulp.src('src/**/*.ts')
    .pipe(tslint({
      configuration: 'tools/tslint/tslint-node.json'
    }))
    .pipe(tslint.report());
}
gulp.task('lint', lint);

function copyToLib () {
  return gulp.src([
    'src/html/*.html',
    'tools/concat/js_prefix.html',
    'transpiled/html/*.js',
    'tools/concat/js_suffix.html'
  ])
  .pipe(concat('oracledb.html'))
  .pipe(addsrc.append(['transpiled/nodejs/*.js', '!transpiled/nodejs/*.spec.js']))
  .pipe(gulp.dest('lib'));
}
gulp.task('copy-to-lib', gulp.series(['compile', copyToLib]));

async function copyToNodeRed () {
  if (node_red_root) {
    return gulp.src(['lib/*.*'])
    .pipe(gulp.dest(node_red_root + '/node_modules/node-red-contrib-oracledb/lib'));
  }
}
gulp.task('copy-to-node-red', gulp.series(['copy-to-lib', copyToNodeRed]));

// unit tests, more a fast integration test because at the moment it uses an external AMQP server
async function test() {
  return gulp.src('transpiled/**/*.spec.js', {
    read: false
  })
    .pipe(mocha({
      r: 'tools/mocha/setup.js',
      reporter: 'dot' // 'spec', 'dot'
    }))
    .on('error', swallowError);
}
gulp.task('test', gulp.series(['copy-to-lib', test]));

function integrationTest() {
  return gulp.src('transpiled/**/*.spec-i.js', {
    read: false
  })
    .pipe(mocha({
      reporter: 'dot' // 'spec', 'dot'
    }))
    .on('error', swallowError);
}
// integration tests, at the moment more an extended version of the unit tests
gulp.task('test:integration', gulp.series(['copy-to-lib', integrationTest]));

function testCoverage() {
  return gulp.src('transpiled/**/*.spec.js', {
    read: false
  })
    .pipe(mocha({
      reporter: 'spec', // 'spec', 'dot'
      istanbul: true
    }));
}
gulp.task('test:coverage', gulp.series(['copy-to-lib', testCoverage]));

gulp.task('build:clean', gulp.series(['clean', 'compile', 'test']));
gulp.task('default', gulp.series(['build:clean']));
gulp.task('build', gulp.series(['compile', 'copy-to-lib', 'test', 'copy-to-node-red']));
gulp.task('watch', gulp.series(['clean', 'build']), function () {
  gulp.watch('server/**/*.ts', ['build']);
});
