import {
 createPaginatedRowModel,
 createSortedRowModel,
 createTableHook,
 rowPaginationFeature,
 rowSortingFeature,
 sortFn_alphanumeric,
 sortFn_basic,
 sortFn_datetime,
 tableFeatures,
} from "@tanstack/react-table";

/**
 * Shared TanStack Table setup (v9 feature-based API).
 *
 * Registers row sorting and pagination once so every table in the app shares
 * the same feature set, sort function registry and row model factories.
 * Usage:
 *
 * const columnHelper = createAppColumnHelper<Row>();
 * const table = useAppTable({ columns, data });
 * <table.AppTable>
 * <thead>
 * {table.getHeaderGroups()[0].headers.map((h) => (
 * <table.AppHeader header={h} key={h.id}>
 * {(header) => <th>{header.FlexRender()}</th>}
 * </table.AppHeader>
 * ))}
 * </thead>
 * ...
 * </table.AppTable>
 */
export const {
 useAppTable,
 createAppColumnHelper,
 useTableContext,
 useCellContext,
 useHeaderContext,
 appFeatures,
} = createTableHook({
 features: tableFeatures({
 rowSortingFeature,
 rowPaginationFeature,
 sortedRowModel: createSortedRowModel(),
 paginatedRowModel: createPaginatedRowModel(),
 sortFns: {
 alphanumeric: sortFn_alphanumeric,
 basic: sortFn_basic,
 datetime: sortFn_datetime,
 },
 }),
 // No pre-bound components yet, so clean intersections (no index signatures).
 tableComponents: {},
 cellComponents: {},
 headerComponents: {},
 });

