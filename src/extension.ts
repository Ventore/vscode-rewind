import { ExtensionContext, window, workspace } from 'vscode';
import { TimelineProvider } from './views/timelineView';

const timelineTreeProvider = TimelineProvider.create(workspace.workspaceFolders);

export async function activate(context: ExtensionContext) {
  context.subscriptions.push(window.registerTreeDataProvider('rewind.views.timeline', timelineTreeProvider));
}
