(function () {
  const vscode = acquireVsCodeApi();

  class StringTableEditor {
    constructor(parent) {
      this.ready = false;
      this.editable = false;
      this.parent = parent;
      this._initElements();
    }

    _initElements() {
      this.metadata = document.createElement("div");
      this.metadata.id = "stbl-metadata";
      this.parent.appendChild(this.metadata);

      this.wrapper = document.createElement("div");
      this.wrapper.id = "stbl-wrapper";
      this.parent.appendChild(this.wrapper);
    }

    /**
     * @param {Array<Object> | undefined} entries
     */
    async redraw(entries) {
      this.wrapper.replaceChildren(
        ...entries?.map((entry) => {
          const entryDiv = document.createElement("div");
          entryDiv.classList.add("stbl-entry");

          const keyP = document.createElement("p");
          keyP.classList.add("key");
          keyP.innerText = entry.key;
          entryDiv.appendChild(keyP);

          const valueP = document.createElement("p");
          valueP.classList.add("value");
          valueP.innerText = entry.value;
          entryDiv.appendChild(valueP);

          return entryDiv;
        })
      );
    }
  }

  const editor = new StringTableEditor(document.getElementById("stbl-editor"));

  // Handle messages from the extension
  window.addEventListener("message", async (e) => {
    const { type, body, requestId } = e.data;
    switch (type) {
      case "init": {
        await editor.redraw(body);
        return;
      }
      case "update": {
        await editor.redraw(body);
        return;
      }
      // case "getFileData": {
      //   // Get the image data for the canvas and post it back to the extension.
      //   editor.getImageData().then((data) => {
      //     vscode.postMessage({
      //       type: "response",
      //       requestId,
      //       body: Array.from(data),
      //     });
      //   });
      //   return;
      // }
    }
  });

  // Signal to VS Code that the webview is initialized.
  vscode.postMessage({ type: "ready" });
})();
