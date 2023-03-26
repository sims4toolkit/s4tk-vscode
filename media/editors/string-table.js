(function () {
  const vscode = acquireVsCodeApi();

  class StringTableEditor {
    constructor(parent) {
      this.ready = false;
      this.parent = parent;
      this._entryMap = new Map();
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

    async redrawEntries(entries) {
      this.wrapper.replaceChildren(
        ...entries.map((entry) => this._addEntry(entry))
      );
    }

    _addEntry(entry) {
      const entryDiv = document.createElement("div");
      entryDiv.classList.add("stbl-entry");
      entryDiv.setAttribute("data-id", entry.id);
      this._entryMap.set(entry.id, entryDiv);

      const keyP = document.createElement("p");
      keyP.classList.add("key");
      keyP.innerText = entry.key;
      entryDiv.appendChild(keyP);

      const valueP = document.createElement("p");
      valueP.classList.add("value");
      valueP.innerText = entry.value;
      entryDiv.appendChild(valueP);

      return entryDiv;
    }

    async applyEdit(edit) {
      switch (edit.op) {
        case "create": {
          const entryDiv = this._addEntry(edit);
          this.wrapper.appendChild(entryDiv);
          return;
        }
        case "update": {
          const entryDiv = this._entryMap(edit.id);
          if (edit.key !== undefined) {
            const keyP = entryDiv.querySelector(".key");
            keyP.innerText = edit.key;
          }
          if (edit.value !== undefined) {
            const valueP = entryDiv.querySelector(".value");
            valueP.innerText = edit.value;
          }
          return;
        }
        case "delete": {
          const entryDiv = this._entryMap(edit.id);
          entryDiv.remove();
          return;
        }
      }
    }
  }

  const editor = new StringTableEditor(document.getElementById("stbl-editor"));

  window.addEventListener("message", async (e) => {
    const { type, body } = e.data;
    switch (type) {
      case "init": {
        await editor.redrawEntries(body);
        return;
      }
      case "edit": {
        await editor.applyEdit(body);
        return;
      }
    }
  });

  vscode.postMessage({ type: "ready" });
})();
