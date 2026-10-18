export function createScrollLockManager(): {
 acquire: (doc: Document) => () => void;
 getCount: () => number;
};
export const pageScrollLocks: ReturnType<typeof createScrollLockManager>;
