/**
 * Screenshot/export utilities for canvas pages.
 * Provides a helper to capture and download canvas as PNG.
 */
(() => {
  function downloadCanvasAsImage(canvasId, filename = 'christmas.png') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn(`Canvas with id "${canvasId}" not found`);
      return;
    }

    function save(url, revoke) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function fail(e) {
      console.error('Failed to export canvas:', e);
      alert('Không thể chụp ảnh. Vui lòng thử lại.');
    }

    try {
      // toBlob avoids building a huge base64 string for high-DPI canvases.
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) save(URL.createObjectURL(blob), true);
          else fail(new Error('empty blob'));
        }, 'image/png');
        return;
      }
      save(canvas.toDataURL('image/png'), false);
    } catch (e) {
      fail(e);
    }
  }

  // Expose as a global utility for HTML onclick handlers
  window.CD_Export = Object.freeze({
    downloadCanvasAsImage,
  });
})();
