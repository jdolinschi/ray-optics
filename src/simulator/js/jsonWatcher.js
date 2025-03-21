// jsonWatcher.js

/**
 * Poll the external JSON endpoint every few seconds.
 * If a new scene JSON is detected, update the scene via editor.loadJSON().
 */
(function setupJSONWatcher() {
    // URL of the Python server endpoint that returns the scene JSON
    const JSON_ENDPOINT = "http://localhost:5000/scene";
    // How often (in milliseconds) to poll for changes
    const POLL_INTERVAL = 3000;

    // Store the last JSON string we received
    let lastJSON = null;

    async function pollSceneJSON() {
        try {
            const response = await fetch(JSON_ENDPOINT, { cache: "no-store" });
            if (!response.ok) {
                console.error("Failed to fetch scene JSON:", response.status);
                return;
            }
            const newJSON = await response.text();

            // If the fetched JSON differs from what we last loaded, update the scene.
            if (newJSON && newJSON !== lastJSON) {
                console.log("Detected updated scene JSON. Updating scene...");
                // Save the new JSON string in the watcher variable.
                lastJSON = newJSON;

                // Make sure the editor object is available.
                if (window.editor && typeof window.editor.loadJSON === "function") {
                    window.editor.loadJSON(newJSON);
                    // If the Ace JSON editor is enabled (visible), update its content too.
                    if (window.aceEditor && typeof window.aceEditor.session !== "undefined") {
                        // Set a flag so that the change event handler in enableJsonEditor doesn't react to this programmatic update.
                        window.lastCodeChangeIsFromScene = true;
                        window.aceEditor.session.setValue(newJSON);
                    }
                } else {
                    console.warn("Editor not ready; skipping update.");
                }
            }
        } catch (e) {
            console.error("Error polling scene JSON:", e);
        }
    }

    // Start polling after a short delay to ensure the simulator is initialized.
    setTimeout(() => {
        pollSceneJSON();
        setInterval(pollSceneJSON, POLL_INTERVAL);
    }, 5000);
})();
