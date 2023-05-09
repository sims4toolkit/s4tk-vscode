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
      this.groupsWrapper = createElement("div", {
        id: "groups-wrapper",
        parent,
      });
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
                cls: "group",
                innerText: `${group.group} (Count: ${group.entries.length})`,
              }),
              createElement("div", {
                cls: "group-entries",
                children: group.entries.map((entry) => {
                  return createElement("div", {
                    cls: "entry",
                    children: [
                      createElement("p", {
                        cls: "details",
                        innerText: entry.details,
                      }),
                      createElement("p", {
                        cls: "key",
                        innerText: entry.key,
                      }),
                      createElement("span", {
                        cls: "link-button",
                        innerText: "View",
                        onclick: () => {
                          vscode.postMessage({ type: "view", body: entry.id });
                        },
                      }),
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

  window.addEventListener("message", async (e) => {
    const { type, body } = e.data;
    switch (type) {
      case "init": {
        await editor.redrawIndex(body);
        return;
      }
    }
  });

  vscode.postMessage({ type: "ready" });
})();
