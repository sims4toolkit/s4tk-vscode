(function () {
  const vscode = acquireVsCodeApi();

  const MAX_SAFE_SIZE = 1000;

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
      this.groupsWrapper = createElement("div", {
        id: "groups-wrapper",
        parent,
      });
    }

    async showLoading() {
      this.groupsWrapper.replaceChildren(
        createElement("p", { innerText: "Reloading..." })
      );
    }

    async redrawIndex(index) {
      if (index.size > MAX_SAFE_SIZE) {
        this._showLargeDbpfMessage(index.groups);
      } else if (index.size > 0) {
        this._renderGroups(index.groups);
      } else {
        this._showEmptyDbpfMessage();
      }
    }

    _renderGroups(groups) {
      this.groupsWrapper.replaceChildren(
        ...groups.map((group) =>
          createElement("div", {
            cls: "pkg-group",
            children: [
              createElement("h4", {
                cls: "group-title",
                innerText: `${group.title}`,
              }),
              createElement("div", {
                cls: "group-entries",
                children: group.entries.map((entry) => {
                  return createElement("div", {
                    cls: "entry",
                    onclick: () => {
                      vscode.postMessage({ type: "view", body: entry.id });
                    },
                    children: [
                      createElement("p", {
                        cls: "filename",
                        innerText: entry.filename,
                      }),
                      createElement("p", {
                        cls: "key",
                        innerText: entry.key,
                      }),
                      // TODO: show linked entries
                    ],
                  });
                }),
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

    _showLargeDbpfMessage(groups) {
      this.groupsWrapper.replaceChildren(
        createElement("p", {
          cls: "margin-bottom",
          innerText: `This package contains ${entries.length} entries; rendering it may cause VS Code to lag or freeze.`,
        }),
        createElement("button", {
          innerText: "I Understand the Risks, Render Anyways",
          onclick: () => {
            this._renderGroups(groups);
          },
        })
      );
    }

    _showEmptyDbpfMessage() {
      this.groupsWrapper.replaceChildren(
        createElement("p", { innerText: "This package is empty." })
      );
    }
  }

  const editor = new PackageEditor(document.getElementById("pkg-editor"));
  document.getElementById("reload-button").onclick = () => {
    vscode.postMessage({ type: "reload" });
  };

  window.addEventListener("message", async ({ data }) => {
    switch (data.type) {
      case "init": {
        await editor.redrawIndex(data.body);
        return;
      }
      case "loading": {
        await editor.showLoading();
        return;
      }
    }
  });

  vscode.postMessage({ type: "ready" });
})();
