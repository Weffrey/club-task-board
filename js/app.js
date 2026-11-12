// ---------------------------------------------------------------------------
// App
//
// State, rendering, and event handling. Knows nothing about Firebase — it asks
// store.js to persist things and re-renders whenever store.js streams new data.
// ---------------------------------------------------------------------------

import { DEFAULT_BOARD_NAME } from "./config.js";
import * as store from "./store.js";

const TEAM_PALETTE = ["#8E5B3F","#3F6B8E","#6B4E8E","#5B7A3F","#8E3F5B","#3F8E82","#8E7A3F","#5B5B8E","#9E4F3F","#4F8E6B"];
const PRIORITY_ORDER = { high:0, medium:1, low:2 };
const STATUS_LIST = [
  { id:"todo",  label:"To do" },
  { id:"doing", label:"In progress" },
  { id:"done",  label:"Done" }
];

var state = {
  boardName: DEFAULT_BOARD_NAME,
  teams: [],
  tasks: [],
  tab: "overview",        // "overview" or a subteam id
  configLoaded: false,
  tasksLoaded: false,
  editingTitle: false,
  modal: null,            // {mode:"add"|"edit", task:{...}}
  settingsOpen: false,
  statusMessage: ""       // banner text, e.g. demo-mode warning
};

function uid(prefix){
  return prefix + "-" + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
}

function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
  });
}

function teamById(id){
  for (var i=0;i<state.teams.length;i++){ if (state.teams[i].id === id) return state.teams[i]; }
  return null;
}

function tasksForTeam(teamId){
  return state.tasks.filter(function(t){ return t.subteamId === teamId; });
}

function sortTasks(list){
  return list.slice().sort(function(a,b){
    var pa = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : 1;
    var pb = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : 1;
    if (pa !== pb) return pa - pb;
    return (a.createdAt||0) - (b.createdAt||0);
  });
}

/* ---------------- persistence shims ---------------- */

function saveConfig(){
  return store.saveConfig({ name: state.boardName, subteams: state.teams });
}
function createTask(task){ return store.createTask(task); }
function updateTask(id, patch){ return store.updateTask(id, patch); }
function deleteTask(id){ return store.deleteTask(id); }

  /* ---------------- rendering ---------------- */

  function render(){
    var app = document.getElementById("app");
    if (!state.configLoaded || !state.tasksLoaded){
      app.innerHTML = '<div class="loading">Loading board…</div>';
      return;
    }

    var html = "";
    html += renderHeader();
    if (state.statusMessage){
      html += '<div class="notice">' + escapeHtml(state.statusMessage) + '</div>';
    }
    html += renderTabs();

    if (state.teams.length === 0){
      html += '<div class="overview-card"><p style="margin:0 0 10px;color:var(--color-ink-soft);font-size:14px;">No subteams yet. Add your first one to start organizing tasks.</p>' +
              '<button class="btn btn-primary" onclick="Board.openSettings()">Add a subteam</button></div>';
    } else if (state.tab === "overview"){
      html += renderOverview();
    } else {
      html += renderKanban(state.tab);
    }

    app.innerHTML = html;

    if (state.modal){ renderModal(); }
    if (state.settingsOpen){ renderSettings(); }
  }

  function renderHeader(){
    var titleHtml;
    if (state.editingTitle){
      titleHtml = '<input class="title-input" id="titleInput" type="text" value="' + escapeHtml(state.boardName) + '" />';
    } else {
      titleHtml = '<h1>' + escapeHtml(state.boardName) + '</h1>' +
        '<button class="edit-title-btn" title="Rename board" onclick="Board.editTitle()">' + pencilIcon() + '</button>';
    }
    return (
      '<div class="header">' +
        '<div class="header-left">' +
          '<p class="eyebrow">Team backlog</p>' +
          '<div class="title-row">' + titleHtml + '</div>' +
        '</div>' +
        '<div class="header-actions">' +
          '<button class="btn btn-icon" title="Manage subteams" onclick="Board.openSettings()">"Subteam management</button>' +
          '<button class="btn btn-primary" onclick="Board.openAdd(null)">' + plusIcon() + ' New task</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderTabs(){
    var overviewCount = state.tasks.length;
    var tabsHtml = '<button class="tab ' + (state.tab==="overview"?"active":"") + '" onclick="Board.setTab(\'overview\')">Overview <span class="tab-count">' + overviewCount + '</span></button>';
    state.teams.forEach(function(team){
      var count = tasksForTeam(team.id).length;
      tabsHtml += '<button class="tab ' + (state.tab===team.id?"active":"") + '" onclick="Board.setTab(\'' + team.id + '\')">' +
        '<span class="tab-dot" style="background:' + team.color + '"></span>' + escapeHtml(team.name) +
        ' <span class="tab-count">' + count + '</span></button>';
    });
    return '<div class="tabs">' + tabsHtml + '</div>';
  }

  function renderOverview(){
    if (state.teams.length === 0) return "";
    var out = '<div class="overview-grid">';
    state.teams.forEach(function(team){
      var list = sortTasks(tasksForTeam(team.id));
      var open = list.filter(function(t){ return t.status !== "done"; }).length;
      var done = list.length - open;
      out += '<div class="overview-card">' +
        '<div class="overview-head">' +
          '<div class="overview-team"><span class="team-dot" style="background:' + team.color + '"></span>' +
            '<span class="overview-team-name">' + escapeHtml(team.name) + '</span></div>' +
          '<div class="overview-stats"><span>' + open + ' open</span><span>' + done + ' done</span></div>' +
        '</div>';
      if (list.length === 0){
        out += '<p class="empty-note">No tasks yet.</p>';
      } else {
        out += '<div class="overview-list">';
        list.slice(0, 6).forEach(function(t){
          out += '<div class="overview-row">' +
            '<span class="priority-pin priority-' + t.priority + '">' + t.priority.toUpperCase() + '</span>' +
            '<span class="overview-row-title" onclick="Board.openEdit(\'' + t.id + '\')">' + escapeHtml(t.title) + '</span>' +
            '<span style="color:var(--color-ink-faint);font-size:12px;">' + statusLabel(t.status) + '</span>' +
          '</div>';
        });
        if (list.length > 6){
          out += '<p class="empty-note">+' + (list.length - 6) + ' more — open the ' + escapeHtml(team.name) + ' tab to see all.</p>';
        }
        out += '</div>';
      }
      out += '</div>';
    });
    out += '</div>';
    return out;
  }

  function statusLabel(id){
    var s = STATUS_LIST.find(function(x){ return x.id === id; });
    return s ? s.label : id;
  }

  function renderKanban(teamId){
    var team = teamById(teamId);
    if (!team) return "";
    var list = tasksForTeam(teamId);
    var out = '<div class="board">';
    STATUS_LIST.forEach(function(col){
      var colTasks = sortTasks(list.filter(function(t){ return t.status === col.id; }));
      out += '<div class="column">' +
        '<div class="column-head"><span class="column-title">' + col.label + '</span><span class="column-count">' + colTasks.length + '</span></div>' +
        '<div class="column-body">';
      colTasks.forEach(function(t){
        out += renderCard(t, team);
      });
      out += '</div>' +
        '<button class="column-add" onclick="Board.openAdd(\'' + teamId + '\',\'' + col.id + '\')">+ Add task</button>' +
      '</div>';
    });
    out += '</div>';
    return out;
  }

  function renderCard(t, team){
    return '<div class="card" style="--card-color:' + team.color + '" onclick="Board.openEdit(\'' + t.id + '\')">' +
      '<div class="card-top">' +
        '<span class="card-title">' + escapeHtml(t.title) + '</span>' +
        '<span class="priority-pin priority-' + t.priority + '">' + t.priority.toUpperCase() + '</span>' +
      '</div>' +
      (t.description ? '<div class="card-desc">' + escapeHtml(t.description) + '</div>' : '') +
      '<div class="card-foot">' +
        '<span class="team-chip"><span class="team-dot" style="background:' + team.color + '"></span>' + escapeHtml(team.name) + '</span>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- modal: add/edit task ---------------- */

  function renderModal(){
    var m = state.modal;
    var isEdit = m.mode === "edit";
    var t = m.task;
    var teamOptions = state.teams.map(function(team){
      return '<option value="' + team.id + '" ' + (team.id===t.subteamId?"selected":"") + '>' + escapeHtml(team.name) + '</option>';
    }).join("");

    var priorityBtns = ["high","medium","low"].map(function(p){
      return '<button type="button" class="seg-btn ' + (t.priority===p?"active-"+p:"") + '" onclick="Board.setModalField(\'priority\',\'' + p + '\')">' + p.charAt(0).toUpperCase()+p.slice(1) + '</button>';
    }).join("");

    var statusBtns = STATUS_LIST.map(function(s){
      return '<button type="button" class="seg-btn ' + (t.status===s.id?"active-status":"") + '" onclick="Board.setModalField(\'status\',\'' + s.id + '\')">' + s.label + '</button>';
    }).join("");

    var overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "taskOverlay";
    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-head"><h2>' + (isEdit ? "Edit task" : "New task") + '</h2>' +
          '<button class="close-btn" onclick="Board.closeModal()">&times;</button></div>' +
        '<div class="field"><label for="f_title">Title</label>' +
          '<input type="text" id="f_title" value="' + escapeHtml(t.title) + '" placeholder="What needs to get done?" /></div>' +
        '<div class="row-2">' +
          '<div class="field"><label for="f_team">Subteam</label><select id="f_team">' + teamOptions + '</select></div>' +
          '<div class="field"><label>Priority</label><div class="seg">' + priorityBtns + '</div></div>' +
        '</div>' +
        '<div class="field"><label>Status</label><div class="seg">' + statusBtns + '</div></div>' +
        '<div class="field"><label for="f_desc">Description</label>' +
          '<textarea id="f_desc" placeholder="What does this task involve?">' + escapeHtml(t.description) + '</textarea></div>' +
        '<div class="field"><label for="f_info">Additional info (links, resources, context)</label>' +
          '<textarea id="f_info" placeholder="Anything helpful for whoever picks this up">' + escapeHtml(t.info) + '</textarea></div>' +
        '<div class="modal-actions">' +
          (isEdit ? '<button class="btn btn-ghost btn-danger" onclick="Board.deleteCurrent()">Delete</button>' : '<span></span>') +
          '<div class="modal-actions-right">' +
            '<button class="btn" onclick="Board.closeModal()">Cancel</button>' +
            '<button class="btn btn-primary" onclick="Board.saveModal()">Save</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var existing = document.getElementById("taskOverlay");
    if (existing) existing.remove();
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e){ if (e.target === overlay) Board.closeModal(); });
    document.getElementById("f_title").focus();
  }

  /* ---------------- settings modal ---------------- */

  function renderSettings(){
    var overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "settingsOverlay";

    var rows = state.teams.map(function(team, idx){
      var swatches = TEAM_PALETTE.map(function(c){
        return '<button type="button" class="swatch-opt ' + (c===team.color?"selected":"") + '" style="background:' + c + '" onclick="Board.setTeamColor(' + idx + ',\'' + c + '\')"></button>';
      }).join("");
      var taskCount = tasksForTeam(team.id).length;
      return '<div class="team-row">' +
          '<span class="swatch" style="background:' + team.color + '"></span>' +
          '<input type="text" value="' + escapeHtml(team.name) + '" onchange="Board.renameTeam(' + idx + ', this.value)" />' +
          '<button class="btn btn-ghost btn-icon" title="' + (taskCount ? "Reassign tasks before removing" : "Remove") + '" onclick="Board.removeTeam(' + idx + ')">' + trashIcon() + '</button>' +
        '</div>' +
        '<div class="swatch-picker" style="margin:0 0 10px 30px;">' + swatches + '</div>';
    }).join("");

    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-head"><h2>Manage subteams</h2><button class="close-btn" onclick="Board.closeSettings()">&times;</button></div>' +
        '<div>' + (rows || '<p class="empty-note">No subteams yet.</p>') + '</div>' +
        '<div class="add-team-row">' +
          '<input type="text" id="newTeamName" placeholder="New subteam name" />' +
          '<button class="btn btn-primary" onclick="Board.addTeam()">Add</button>' +
        '</div>' +
        '<div class="modal-actions"><span></span><button class="btn" onclick="Board.closeSettings()">Done</button></div>' +
      '</div>';

    var existingS = document.getElementById("settingsOverlay");
    if (existingS) existingS.remove();
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e){ if (e.target === overlay) Board.closeSettings(); });
  }

  /* ---------------- icons ---------------- */
  function plusIcon(){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'; }
  function gearIcon(){ return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>'; }
  function pencilIcon(){ return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'; }
  function trashIcon(){ return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>'; }

  /* ---------------- controller ---------------- */

  var Board = {
    setTab:function(id){ state.tab = id; render(); },

    editTitle:function(){
      state.editingTitle = true;
      render();
      var inp = document.getElementById("titleInput");
      if (inp){
        inp.focus(); inp.select();
        inp.addEventListener("keydown", function(e){
          if (e.key === "Enter") Board.commitTitle(inp.value);
          if (e.key === "Escape"){ state.editingTitle = false; render(); }
        });
        inp.addEventListener("blur", function(){ Board.commitTitle(inp.value); });
      }
    },
    commitTitle:function(val){
      state.editingTitle = false;
      state.boardName = (val || "").trim() || "Club Task Board";
      saveConfig();
    },

    openAdd:function(teamId, statusId){
      var defaultTeam = teamId || (state.teams[0] ? state.teams[0].id : "");
      state.modal = { mode:"add", task:{ title:"", description:"", info:"", subteamId:defaultTeam, priority:"medium", status:statusId || "todo" } };
      render();
    },
    openEdit:function(taskId){
      var t = state.tasks.find(function(x){ return x.id === taskId; });
      if (!t) return;
      state.modal = { mode:"edit", task:Object.assign({}, t) };
      render();
    },
    setModalField:function(field, value){
      // Preserve anything typed in text fields before the modal re-renders.
      var fTitle = document.getElementById("f_title");
      var fDesc = document.getElementById("f_desc");
      var fInfo = document.getElementById("f_info");
      var fTeam = document.getElementById("f_team");
      if (fTitle) state.modal.task.title = fTitle.value;
      if (fDesc) state.modal.task.description = fDesc.value;
      if (fInfo) state.modal.task.info = fInfo.value;
      if (fTeam) state.modal.task.subteamId = fTeam.value;
      state.modal.task[field] = value;
      render();
    },
    closeModal:function(){
      var overlay = document.getElementById("taskOverlay");
      if (overlay) overlay.remove();
      state.modal = null;
    },
    saveModal:function(){
      var t = state.modal.task;
      t.title = (document.getElementById("f_title").value || "").trim();
      t.subteamId = document.getElementById("f_team").value;
      t.description = document.getElementById("f_desc").value || "";
      t.info = document.getElementById("f_info").value || "";
      if (!t.title){
        document.getElementById("f_title").style.borderColor = "var(--color-danger)";
        return;
      }
      var payload = { title:t.title, subteamId:t.subteamId, priority:t.priority, status:t.status, description:t.description, info:t.info };
      if (state.modal.mode === "edit"){
        updateTask(t.id, payload);
      } else {
        createTask(payload);
      }
      Board.closeModal();
      render();
    },
    deleteCurrent:function(){
      var t = state.modal.task;
      deleteTask(t.id);
      Board.closeModal();
      render();
    },

    openSettings:function(){ state.settingsOpen = true; render(); },
    closeSettings:function(){
      var overlay = document.getElementById("settingsOverlay");
      if (overlay) overlay.remove();
      state.settingsOpen = false;
    },
    addTeam:function(){
      var inp = document.getElementById("newTeamName");
      var name = (inp.value || "").trim();
      if (!name) return;
      var color = TEAM_PALETTE[state.teams.length % TEAM_PALETTE.length];
      state.teams = state.teams.concat([{ id:uid("team"), name:name, color:color }]);
      inp.value = "";
      saveConfig();
      render();
    },
    renameTeam:function(idx, value){
      var name = (value || "").trim();
      if (!name) { render(); return; }
      state.teams[idx].name = name;
      saveConfig();
    },
    setTeamColor:function(idx, color){
      var newName = document.getElementById("newTeamName");
      var preserved = newName ? newName.value : "";
      state.teams[idx].color = color;
      saveConfig();
      render();
      var again = document.getElementById("newTeamName");
      if (again && preserved) again.value = preserved;
    },
    removeTeam:function(idx){
      var team = state.teams[idx];
      if (!team) return;
      var count = tasksForTeam(team.id).length;
      if (count > 0){
        alert("This subteam still has " + count + " task(s). Move or delete them first, then remove the subteam.");
        return;
      }
      state.teams = state.teams.filter(function(t){ return t.id !== team.id; });
      if (state.tab === team.id) state.tab = "overview";
      saveConfig();
      render();
    }
  };
  window.Board = Board;

/* ---------------- bootstrap ---------------- */

store.connect({
  onConfig: function(config){
    state.boardName = config.name || DEFAULT_BOARD_NAME;
    state.teams = config.subteams || [];
    state.configLoaded = true;
    render();
  },
  onTasks: function(tasks){
    state.tasks = tasks;
    state.tasksLoaded = true;
    render();
  },
  onStatus: function(status){
    state.statusMessage = status.message || "";
    render();
  }
});
