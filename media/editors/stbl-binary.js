(function () {
  const vscode = acquireVsCodeApi();

  const MAX_STBL_SIZE = 1000;

  function createElement(tag, options) {
    const element = document.createElement(tag);
    options?.parent?.appendChild(element);
    if (options?.id) element.id = options.id;
    if (options?.innerText) element.innerText = options.innerText;
    if (options?.onclick) element.onclick = options.onclick;
    if (options?.cls) element.classList.add(options.cls);
    options?.children?.forEach((child) => element.appendChild(child));
    return element;
  }

  class StringTableEditor {
    constructor(parent) {
      this.ready = false;
      this.parent = parent;
      this.entriesWrapper = createElement("div", {
        id: "entries-wrapper",
        parent,
      });
    }

    async redrawEntries(entries) {
      if (entries.length > MAX_STBL_SIZE) {
        this._showLargeStblMessage(entries);
      } else if (entries.length > 0) {
        this._renderEntries(entries);
      } else {
        this._showEmptyStblMessage();
      }
    }

    _renderEntries(entries) {
      this.entriesWrapper.replaceChildren(
        ...entries.map((entry) =>
          createElement("div", {
            cls: "stbl-entry",
            children: [
              createElement("p", {
                cls: "key",
                innerText: entry.key,
              }),
              createElement("p", {
                cls: "value",
                innerText: entry.value,
              }),
            ],
          })
        )
      );
    }

    _showLargeStblMessage(entries) {
      this.entriesWrapper.replaceChildren(
        createElement("p", {
          cls: "margin-bottom",
          innerText: `This string table contains ${entries.length} entries; rendering it may cause VS Code to lag or freeze. It is recommended that you separate this STBL into several smaller JSONs, and let the build process merge them.`,
        }),
        createElement("button", {
          innerText: "I Understand the Risks, Render Anyways",
          onclick: () => {
            this._renderEntries(entries);
          },
        })
      );
    }

    _showEmptyStblMessage() {
      this.entriesWrapper.replaceChildren(
        createElement("p", { innerText: "This string table is empty." })
      );
    }
  }

  const editor = new StringTableEditor(document.getElementById("stbl-editor"));

  const convertToJsonBtn = document.getElementById("convert-to-json-btn");
  convertToJsonBtn.onclick = () => {
    vscode.postMessage({ type: "convertToJson" });
  };

  window.addEventListener("message", async (e) => {
    const { type, body } = e.data;
    switch (type) {
      case "init": {
        await editor.redrawEntries(body);
        return;
      }
    }
  });

  vscode.postMessage({ type: "ready" });
})();
