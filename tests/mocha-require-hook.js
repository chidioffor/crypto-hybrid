const url = require('url');

try {
  const esmUtils = require('mocha/lib/nodejs/esm-utils');

  if (esmUtils && typeof esmUtils.doImport === 'function') {
    const originalDoImport = esmUtils.doImport;

    esmUtils.doImport = async specifier => {
      try {
        return await originalDoImport(specifier);
      } catch (error) {
        const notSupported =
          error &&
          (error.code === 'ERR_MODULE_NOT_FOUND' ||
            error.code === 'ERR_UNKNOWN_FILE_EXTENSION' ||
            error.code === 'ERR_UNSUPPORTED_ESM_URL_SCHEME' ||
            error.code === 'ERR_UNSUPPORTED_ESM_PACKAGE_IMPORT' ||
            error.message === 'Not supported');

        if (!notSupported) {
          throw error;
        }

        const resolved =
          typeof specifier === 'string'
            ? specifier
            : specifier && typeof specifier.href === 'string'
            ? specifier.href
            : specifier && typeof specifier.toString === 'function'
            ? specifier.toString()
            : specifier;

        const filePath = resolved && resolved.startsWith('file:')
          ? url.fileURLToPath(resolved)
          : resolved;

        if (!filePath) {
          throw error;
        }

        return require(filePath);
      }
    };
  }
} catch (patchError) {
  // Failing to patch Mocha shouldn't prevent the suite from running.
  // The original error will surface when Mocha attempts to load the files.
  console.warn('Unable to apply Mocha CommonJS compatibility patch:', patchError.message);
}
