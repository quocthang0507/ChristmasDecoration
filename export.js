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

    try {
      const url = canvas.toDataURL('image/png', 0.95);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to export canvas:', e);
      alert('Không thể chụp ảnh. Vui lòng thử lại.');
    }
  }

  // Expose as a global utility for HTML onclick handlers
  window.CD_Export = Object.freeze({
    downloadCanvasAsImage,
  });
})();
