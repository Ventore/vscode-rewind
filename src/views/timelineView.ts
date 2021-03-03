import {
  ThemeColor,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  WorkspaceFolder,
} from 'vscode';
import simpleGit, { DefaultLogFields, GitError } from 'simple-git';
import * as parseDiff from 'parse-diff';

interface Node {
  load(): Promise<Node[]> | Node[];
  get(): TreeItem;
}

class File extends TreeItem implements Node {
  static create(file: parseDiff.File) {
    const paths = file.to?.split('/') || [];
    return new File(file, paths.pop() || 'Unknown', paths.join('/'));
  }

  constructor(private file: parseDiff.File, name: string, path?: string) {
    super(name);
    this.description = path;
  }
  load() {
    return [];
  }

  get() {
    return this;
  }

  iconPath = new ThemeIcon(...this.getStatus());

  private getStatus(): [string, ThemeColor] {
    if (this.file.additions > 0 && this.file.deletions === 0) {
      return ['diff-added', new ThemeColor('charts.green')];
    }
    if (this.file.additions > 0 && this.file.deletions > 0) {
      return ['diff-modified', new ThemeColor('charts.yellow')];
    }
    return ['diff-removed', new ThemeColor('charts.red')];
  }
}

class Commit extends TreeItem implements Node {
  static from(path: string, log: DefaultLogFields): Commit {
    return new Commit(path, log);
  }

  constructor(private path: string, private commit: DefaultLogFields) {
    super(commit.message, TreeItemCollapsibleState.Collapsed);
  }

  load() {
    return new Promise<Node[]>((resolve, reject) => {
      simpleGit(this.path).show(
        [this.commit.hash, '-p', '--first-parent'],
        (err: GitError | null, info?: string) => {
          if (err) {
            return reject(err);
          }

          return resolve(parseDiff(info).map(File.create));
        },
      );
    });
  }

  get() {
    return this;
  }

  iconPath = new ThemeIcon('git-commit');
}

class Repository extends TreeItem implements Node {
  static create(folder: WorkspaceFolder) {
    return new Repository(folder);
  }

  constructor(private folder: WorkspaceFolder) {
    super(folder.name, TreeItemCollapsibleState.Collapsed);
  }

  async load(): Promise<Node[]> {
    const logs = await simpleGit(this.folder.uri.path).log(['-c']);

    return logs.all.map((log) => Commit.from(this.folder.uri.path, log));
  }

  get() {
    return this;
  }
}

export class TimelineProvider implements TreeDataProvider<Node> {
  static create(workspaceFolders: readonly WorkspaceFolder[] = []) {
    const nodes = workspaceFolders.map(Repository.create);

    return new TimelineProvider(nodes);
  }

  constructor(private nodes: Node[]) {}

  public async getTreeItem(node: Node): Promise<TreeItem> {
    return node.get();
  }
  public async getChildren(node?: Node): Promise<Node[]> {
    if (!node) {
      return this.getRootNodes();
    }

    return node.load();
  }

  private getRootNodes() {
    if (this.nodes.length === 1) {
      return this.nodes[0].load();
    }

    return this.nodes;
  }
}
