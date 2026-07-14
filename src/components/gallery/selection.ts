/** Selection state passed to a project card/row while multi-select is active. */
export type SelectionProps = {
  /** Whether the gallery is in multi-select mode. */
  active: boolean;
  /** Whether this item is currently selected. */
  selected: boolean;
  /** Toggles this item's selection by id. */
  onToggle: (id: string) => void;
};
