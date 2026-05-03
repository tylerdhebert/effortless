import { app, BrowserWindow, ipcMain, shell, Notification } from 'electron'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getLatestTaskBuild, runTaskBuild } from '../core/builds'
import { getAppState, openDatabase, updateNotificationSettings } from '../core/db'
import type { NotificationSettings } from '../core/db'
import { createDiscussionMessage, listDiscussionMessages } from '../core/discussion'
import { listEfforts, createEffort, updateEffortSummary, updateEffortPlanRequiresReview } from '../core/efforts'
import { browsePath } from '../core/filesystem'
import {
  answerInputRequest,
  createInputRequest,
  getInputRequestByRef,
  listInputRequests,
  listPendingInputRequests,
} from '../core/inputs'
import {
  listPendingNotifications,
  countPendingNotifications,
} from '../core/notifications'
import {
  createMandate,
  deleteMandate,
  listMandates,
  listMandatesBySurface,
  resolveMandateText,
  updateMandate,
} from '../core/mandates'
import { acceptPlan, createPlan, getPlanByRef, listPlanComments, listPlans, markPlanReady, requestPlanChanges } from '../core/plans'
import {
  createReference,
  deleteReference,
  listReferences,
} from '../core/references'
import { createRepo, deleteRepo, listRepos, updateRepo } from '../core/repos'
import { applyReview, getReviewByRef, listReviews, requestReviewChanges, submitReview } from '../core/reviews'
import {
  checkpointTask,
  claimTask,
  ensureTaskWorktree,
  approveTask,
  getTaskCommitView,
  getTaskConflictView,
  getTaskDiffView,
  listTaskComments,
  listTasks,
  listAllTasks,
  markTaskReady,
  mergeTask,
  requestTaskChanges,
  updateTaskDetails,
  updateTaskAutoMerge,
  updateTaskRequiresReview,
  updateTaskReviewRequiresReview,
} from '../core/tasks'
import type {
  AnswerInputRequestInput,
  ApplyReviewInput,
  ApproveTaskInput,
  CheckpointTaskInput,
  ClaimTaskInput,
  CreateInputRequestInput,
  CreateDiscussionMessageInput,
  CreateMandateInput,
  CreatePlanInput,
  CreateReferenceInput,
  CreateRepoInput,
  RequestPlanChangesInput,
  RequestReviewChangesInput,
  RequestTaskChangesInput,
  SubmitReviewInput,
  UpdateMandateInput,
  UpdateRepoInput,
  UpdateTaskDetailsInput,
  WorkSurface,
  ReferenceOwnerType,
  DiffType,
} from '../core/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

const effortlessHome = process.env.EFFORTLESS_HOME
if (effortlessHome) {
  const electronHome = path.join(effortlessHome, 'electron')
  app.setPath('userData', electronHome)
  app.setPath('sessionData', path.join(electronHome, 'session'))
}

const playwrightRemoteDebuggingPort = process.env.PLAYWRIGHT_REMOTE_DEBUGGING_PORT
if (playwrightRemoteDebuggingPort) {
  app.commandLine.appendSwitch('remote-debugging-port', playwrightRemoteDebuggingPort)
}

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
const db = openDatabase()

ipcMain.handle('app-state:get', () => getAppState(db))
ipcMain.handle('filesystem:browse', (_event, targetPath?: string | null, includeFiles = false) =>
  browsePath(targetPath, includeFiles),
)
ipcMain.handle('filesystem:open', async (_event, targetPath: string) => {
  const result = await shell.openPath(targetPath)
  if (result) {
    throw new Error(result)
  }
})
ipcMain.handle('efforts:list', () => listEfforts(db))
ipcMain.handle('repos:list', () => listRepos(db))
ipcMain.handle('repos:create', (_event, input: CreateRepoInput) => createRepo(db, input))
ipcMain.handle('repos:update', (_event, input: UpdateRepoInput) => updateRepo(db, input))
ipcMain.handle('repos:delete', (_event, repoId: number) => deleteRepo(db, repoId))
ipcMain.handle('inputs:list', (_event, effortId: number) => listInputRequests(db, effortId))
ipcMain.handle('inputs:pending', (_event, effortId: number) => listPendingInputRequests(db, effortId))
ipcMain.handle('inputs:create', (_event, input: CreateInputRequestInput) => createInputRequest(db, input))
ipcMain.handle('inputs:answer', (_event, input: AnswerInputRequestInput) => answerInputRequest(db, input))
ipcMain.handle('inputs:show', (_event, inputRef: string) => getInputRequestByRef(db, inputRef))
ipcMain.handle('notifications:list', () => listPendingNotifications(db))
ipcMain.handle('notifications:count', () => countPendingNotifications(db))
ipcMain.handle('notifications:show-os', (_event, title: string, body: string) => {
  if (!Notification.isSupported()) return
  new Notification({ title, body }).show()
})
ipcMain.handle('notifications:updateSettings', (_event, settings: NotificationSettings) =>
  updateNotificationSettings(db, settings),
)

ipcMain.handle('efforts:create', (_event, input: { title: string; description: string; template: 'bugfix' | 'delivery' | 'investigation' | 'discussion' }) =>
  createEffort(db, input),
)
ipcMain.handle('efforts:updateSummary', (_event, effortId: number, summary: string) =>
  updateEffortSummary(db, effortId, summary),
)
ipcMain.handle('efforts:updatePlanRequiresReview', (_event, effortId: number, planRequiresReview: boolean) =>
  updateEffortPlanRequiresReview(db, effortId, planRequiresReview),
)

ipcMain.handle('tasks:list', (_event, effortId: number) => listTasks(db, effortId))
ipcMain.handle('tasks:listAll', () => listAllTasks(db))
ipcMain.handle('plans:list', (_event, effortId: number) => listPlans(db, effortId))
ipcMain.handle('plans:show', (_event, planRef: string) => getPlanByRef(db, planRef))
ipcMain.handle('plans:comments', (_event, planId: number) => listPlanComments(db, planId))
ipcMain.handle('plans:create', (_event, input: CreatePlanInput) => createPlan(db, input))
ipcMain.handle('plans:accept', (_event, planId: number) => acceptPlan(db, planId))
ipcMain.handle('plans:ready', (_event, planId: number) => markPlanReady(db, planId))
ipcMain.handle('plans:requestChanges', (_event, input: RequestPlanChangesInput) =>
  requestPlanChanges(db, input),
)
ipcMain.handle('discussion:list', (_event, effortId: number) => listDiscussionMessages(db, effortId))
ipcMain.handle('discussion:create', (_event, input: CreateDiscussionMessageInput) =>
  createDiscussionMessage(db, input),
)

ipcMain.handle('tasks:comments', (_event, taskId: number) => listTaskComments(db, taskId))
ipcMain.handle('reviews:list', (_event, taskId: number) => listReviews(db, taskId))
ipcMain.handle('reviews:submit', (_event, input: SubmitReviewInput) => submitReview(db, input))
ipcMain.handle('reviews:apply', (_event, input: ApplyReviewInput) => applyReview(db, input))
ipcMain.handle('reviews:requestChanges', (_event, input: RequestReviewChangesInput) =>
  requestReviewChanges(db, input),
)
ipcMain.handle('reviews:show', (_event, reviewRef: string) => getReviewByRef(db, reviewRef))

ipcMain.handle('tasks:claim', (_event, input: ClaimTaskInput) => claimTask(db, input))

ipcMain.handle('tasks:checkpoint', (_event, input: CheckpointTaskInput) =>
  checkpointTask(db, input),
)

ipcMain.handle('tasks:ready', (_event, taskId: number) => markTaskReady(db, taskId))
ipcMain.handle('tasks:merge', (_event, taskId: number) => mergeTask(db, taskId))
ipcMain.handle('tasks:worktree', (_event, taskId: number) => ensureTaskWorktree(db, taskId))
ipcMain.handle('tasks:diff', (_event, taskId: number, type: DiffType = 'combined') =>
  getTaskDiffView(db, taskId, type),
)
ipcMain.handle('tasks:commits', (_event, taskId: number) => getTaskCommitView(db, taskId))
ipcMain.handle('tasks:conflicts', (_event, taskId: number) => getTaskConflictView(db, taskId))
ipcMain.handle('tasks:updateDetails', (_event, input: UpdateTaskDetailsInput) =>
  updateTaskDetails(db, input),
)
ipcMain.handle('tasks:updateRequiresReview', (_event, taskId: number, requiresReview: boolean) =>
  updateTaskRequiresReview(db, taskId, requiresReview),
)
ipcMain.handle('tasks:updateReviewRequiresReview', (_event, taskId: number, reviewRequiresReview: boolean) =>
  updateTaskReviewRequiresReview(db, taskId, reviewRequiresReview),
)
ipcMain.handle('tasks:updateAutoMerge', (_event, taskId: number, autoMerge: boolean) =>
  updateTaskAutoMerge(db, taskId, autoMerge),
)
ipcMain.handle('builds:latest', (_event, taskId: number) => getLatestTaskBuild(db, taskId))
ipcMain.handle('builds:run', (_event, taskId: number) => runTaskBuild(db, taskId))

ipcMain.handle('tasks:approve', (_event, input: ApproveTaskInput) => approveTask(db, input))

ipcMain.handle('tasks:requestChanges', (_event, input: RequestTaskChangesInput) =>
  requestTaskChanges(db, input),
)

ipcMain.handle('mandates:list', () => listMandates(db))
ipcMain.handle('mandates:listBySurface', (_event, workSurface: WorkSurface, repoId: number | null) =>
  listMandatesBySurface(db, workSurface, repoId),
)
ipcMain.handle('mandates:create', (_event, input: CreateMandateInput) => createMandate(db, input))
ipcMain.handle('mandates:update', (_event, input: UpdateMandateInput) => updateMandate(db, input))
ipcMain.handle('mandates:delete', (_event, mandateId: number) => deleteMandate(db, mandateId))
ipcMain.handle('mandates:resolve', (_event, workSurface: WorkSurface, repoId: number | null) =>
  resolveMandateText(db, workSurface, repoId),
)

ipcMain.handle('references:list', (_event, ownerType: ReferenceOwnerType, ownerId: number) =>
  listReferences(db, ownerType, ownerId),
)
ipcMain.handle('references:create', (_event, input: CreateReferenceInput) =>
  createReference(db, input),
)
ipcMain.handle('references:delete', (_event, refId: number) => deleteReference(db, refId))
ipcMain.handle('debug:capture-screenshot', async (_event, relativePath?: string) => {
  if (!win) {
    throw new Error('Main window is not available')
  }

  const outputDir = process.env.PLAYWRIGHT_ARTIFACT_DIR ?? path.join(process.env.APP_ROOT, '.playwright-mcp')
  const relativeOutputPath = relativePath && relativePath.trim().length > 0
    ? relativePath
    : `capture-${Date.now()}.png`
  const outputPath = path.resolve(outputDir, relativeOutputPath)

  if (!outputPath.startsWith(path.resolve(outputDir))) {
    throw new Error('Screenshot path must stay within the configured artifact directory')
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  const image = await win.webContents.capturePage(undefined, {
    stayHidden: true,
    stayAwake: true,
  })
  const png = image.toPNG()
  await writeFile(outputPath, png)

  return {
    path: outputPath,
    sha256: createHash('sha256').update(png).digest('hex'),
  }
})

ipcMain.handle('window:minimize', () => {
  win?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  win?.close()
})

ipcMain.handle('window:isMaximized', () => {
  return win?.isMaximized() ?? false
})

const isMac = process.platform === 'darwin'

function createWindow() {
  win = new BrowserWindow({
    ...(isMac
      ? { titleBarStyle: 'hidden' as const }
      : { frame: false }),
    minWidth: 960,
    minHeight: 600,
    icon: path.join(process.env.VITE_PUBLIC, 'assets', 'icon.png'),
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.maximize()

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
