export const config = {
  repoRoot: process.env.APP_REPO_ROOT ?? process.cwd(),
  port: Number(process.env.PORT) || 31415,
};
