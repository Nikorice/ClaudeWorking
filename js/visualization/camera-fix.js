/**
 * camera-fix.js - Simple camera positioning fix for STL viewer
 * 
 * This minimal script ensures models are visible on initial load
 * by properly positioning the camera after the model is loaded.
 */

(function() {
    // Make sure document is loaded before trying to access the viewer
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCameraFix);
    } else {
      initCameraFix();
    }
  
    function initCameraFix() {
      // Wait a moment to ensure all scripts are loaded
      setTimeout(function() {
        // Check if the PrinterCalc namespace and ModelViewer exist
        if (!window.PrinterCalc || !window.PrinterCalc.ModelViewer) {
          console.log("ModelViewer not available yet, will try again in 500ms");
          setTimeout(initCameraFix, 500);
          return;
        }
  
        console.log("Installing camera positioning fix");
        installCameraFix();
      }, 100);
    }
  
    function installCameraFix() {
      // Store the original loadSTL method
      const originalLoadSTL = PrinterCalc.ModelViewer.loadSTL;
      
      // Replace with our enhanced version
      PrinterCalc.ModelViewer.loadSTL = async function(viewerId, fileOrBuffer) {
        // Call the original method
        await originalLoadSTL.call(this, viewerId, fileOrBuffer);
        
        // Give the model a moment to fully load into the scene
        setTimeout(() => {
          fixCameraPosition(viewerId);
        }, 200);
      };
      
      // Add a method to position the camera correctly
      function fixCameraPosition(viewerId) {
        try {
          // Get the viewer for this ID
          const viewer = PrinterCalc.ModelViewer.viewers[viewerId];
          if (!viewer || !viewer.threeContext) {
            console.warn(`Viewer ${viewerId} not found for camera positioning`);
            return;
          }
          
          const context = viewer.threeContext;
          const { scene, camera, controls } = context;
          
          if (!scene || !camera) {
            console.warn("Scene or camera not available");
            return;
          }
          
          // Find the model mesh directly from scene children
          // This avoids using the problematic traverse() method
          let modelMesh = null;
          
          // Look for mesh objects in the scene
          for (let i = 0; i < scene.children.length; i++) {
            const child = scene.children[i];
            if (child.type === "Mesh" || child.isMesh) {
              modelMesh = child;
              break;
            }
          }
          
          if (!modelMesh) {
            console.warn("No model mesh found in scene");
            return;
          }
          
          // Force computation of bounding box if needed
          if (!modelMesh.geometry.boundingBox) {
            modelMesh.geometry.computeBoundingBox();
          }
          
          // Get bounding box
          const boundingBox = modelMesh.geometry.boundingBox;
          
          // Calculate center of bounding box
          const center = new THREE.Vector3();
          boundingBox.getCenter(center);
          
          // Calculate size
          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          
          // Get maximum dimension for proper zoom level
          const maxDim = Math.max(size.x, size.y, size.z);
          
          // Calculate optimal camera distance based on field of view
          const fov = camera.fov * (Math.PI / 180);
          const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * 1.5; // Add 50% padding
          
          // Position camera at isometric-like angle for better 3D visualization
          camera.position.set(
            center.x + cameraDistance * 0.8, 
            center.y + cameraDistance * 0.8, 
            center.z + cameraDistance * 0.8
          );
          
          // Look at center
          camera.lookAt(center);
          
          // Update controls target
          if (controls && controls.target) {
            controls.target.copy(center);
            controls.update();
          }
          
          // Force a render
          if (context.renderer) {
            context.renderer.render(scene, camera);
          }
          
          console.log(`Camera positioned for model in viewer ${viewerId}`);
        } catch (error) {
          console.error("Error positioning camera:", error);
        }
      }
      
      // Also hook into orientation changes to maintain proper view
      const originalChangeOrientation = PrinterCalc.ModelViewer.changeOrientation;
      
      PrinterCalc.ModelViewer.changeOrientation = function(viewerId, orientation) {
        // Call original method
        originalChangeOrientation.call(this, viewerId, orientation);
        
        // Reposition camera after orientation change
        setTimeout(() => {
          fixCameraPosition(viewerId);
        }, 200);
      };
      
      console.log("Camera positioning fix installed successfully");
    }
  })();