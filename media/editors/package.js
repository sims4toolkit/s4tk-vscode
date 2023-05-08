(function () {
  const vscode = acquireVsCodeApi();

  const MAX_SAFE_SIZE = 2000;

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

  class PackageEditor {
    constructor(parent) {
      this.ready = false;
      this.parent = parent;
      this.entriesWrapper = createElement("div", {
        id: "entries-wrapper",
        parent,
      });
    }

    async redrawEntries(entries) {
      if (entries.length > MAX_SAFE_SIZE) {
        this._showLargeDbpfMessage(entries);
      } else if (entries.length > 0) {
        this._renderEntries(entries);
      } else {
        this._showEmptyDbpfMessage();
      }
    }

    _renderEntries(entries) {
      this.entriesWrapper.replaceChildren(
        ...entries.map((entry) =>
          createElement("div", {
            cls: "pkg-entry",
            children: [
              createElement("p", {
                cls: "key",
                innerText: entry.key,
              }),
              createElement("p", {
                cls: "details",
                innerText: entry.details,
              }),
              // ...(entry.warnings?.map((warning) => {
              //   createElement("p", {
              //     cls: "warnings",
              //     innerText: warning,
              //   });
              // }) ?? []),
            ],
          })
        )
      );
    }

    _showLargeDbpfMessage(entries) {
      this.entriesWrapper.replaceChildren(
        createElement("p", {
          cls: "margin-bottom",
          innerText: `This package contains ${entries.length} entries; rendering it may cause VS Code to lag or freeze.`,
        }),
        createElement("button", {
          innerText: "I Understand the Risks, Render Anyways",
          onclick: () => {
            this._renderEntries(entries);
          },
        })
      );
    }

    _showEmptyDbpfMessage() {
      this.entriesWrapper.replaceChildren(
        createElement("p", { innerText: "This package is empty." })
      );
    }
  }

  const editor = new PackageEditor(document.getElementById("pkg-editor"));

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
