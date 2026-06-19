// public/tesseract/ocr-worker.js
//
// Custom tesseract.js worker that fixes importScripts() failures
// when loading tesseract-core-*.wasm.js files.
//
// PROBLEM:
//   On some servers/proxies (e.g., netlify dev), .wasm.js files may be
//   served with incorrect MIME types (e.g., application/octet-stream or
//   application/wasm instead of application/javascript). Combined with
//   X-Content-Type-Options: nosniff, the browser refuses to execute
//   the script via importScripts(), causing:
//     "NetworkError: Failed to execute 'importScripts' on
//      'WorkerGlobalScope': The script at '...wasm.js' failed to load."
//
// SOLUTION:
//   Override importScripts to intercept tesseract core file loading.
//   For these files, use synchronous XHR (allowed in Workers) to fetch
//   the content with forced MIME type override, create a Blob URL with
//   the correct type, and call importScripts with the Blob URL.
//
// USAGE:
//   createWorker('eng', 1, {
//     workerPath: `${window.location.origin}/tesseract/ocr-worker.js`,
//     workerBlobURL: false,  // IMPORTANT: must be false so self.location works
//     corePath: `${window.location.origin}/tesseract`,
//     langPath: 'https://tessdata.projectnaptha.com/4.0.0',
//     ...
//   });

(function () {
  'use strict';

  // Save original importScripts
  var _origImportScripts = self.importScripts.bind(self);

  // Override importScripts to handle tesseract core files
  self.importScripts = function () {
    var urls = Array.prototype.slice.call(arguments);
    var processedUrls = [];

    for (var i = 0; i < urls.length; i++) {
      var url = urls[i];

      // Intercept tesseract core WASM JS files
      // These are the files that fail with incorrect MIME types
      if (
        typeof url === 'string' &&
        url.indexOf('tesseract-core-') !== -1 &&
        url.indexOf('.wasm.js') !== -1
      ) {
        try {
          // Use synchronous XHR to fetch the script content.
          // Synchronous XHR is deprecated in the main thread but still
          // fully supported in Worker contexts.
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, false); // false = synchronous
          // Force the correct MIME type so the browser interprets
          // the response as JavaScript regardless of what the server sends
          xhr.overrideMimeType('application/javascript');
          xhr.send();

          if (
            (xhr.status >= 200 && xhr.status < 300) ||
            xhr.status === 0
          ) {
            // Create a Blob with the correct MIME type
            if (
              typeof Blob !== 'undefined' &&
              typeof URL !== 'undefined' &&
              typeof URL.createObjectURL === 'function'
            ) {
              var blob = new Blob([xhr.responseText], {
                type: 'application/javascript',
              });
              var blobUrl = URL.createObjectURL(blob);
              processedUrls.push(blobUrl);
            } else {
              // Blob API not available, fall back to original URL
              processedUrls.push(url);
            }
          } else {
            // XHR HTTP error, fall back to original URL
            processedUrls.push(url);
          }
        } catch (e) {
          // XHR failed, fall back to original URL (will likely also fail
          // but at least the error message will be the original one)
          processedUrls.push(url);
        }
      } else {
        // Not a tesseract core file, pass through unchanged
        processedUrls.push(url);
      }
    }

    // Call original importScripts with processed URLs
    return _origImportScripts.apply(self, processedUrls);
  };

  // Determine base URL from this worker's location.
  // This works because workerBlobURL is set to false,
  // so self.location.href is the actual URL of this file,
  // e.g., "http://localhost:8888/tesseract/ocr-worker.js"
  var baseUrl = self.location.href.substring(
    0,
    self.location.href.lastIndexOf('/') + 1
  );

  // Load the actual tesseract worker script
  _origImportScripts(baseUrl + 'worker.min.js');
})();