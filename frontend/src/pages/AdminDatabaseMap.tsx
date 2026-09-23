import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { AdminDatabaseRelationship, AdminDatabaseTableOverview } from '@lp-tracker/contracts';

interface AdminDatabaseMapProps {
  tables: AdminDatabaseTableOverview[];
  relationships: AdminDatabaseRelationship[];
}
interface MapNode {
  table: AdminDatabaseTableOverview;
  level: number;
}
interface MapLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}
function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let current = value / 1024;
  let unit = 0;

  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current.toFixed(current >= 10 ? 1 : 2)} ${units[unit]}`;
}
function calculateLevels(
  tables: AdminDatabaseTableOverview[],
  relationships: AdminDatabaseRelationship[],
): MapNode[] {
  const names = new Set(tables.map((table) => table.name));
  const parents = new Map<string, string[]>();
  for (const relationship of relationships) {
    if (names.has(relationship.sourceTable) && names.has(relationship.targetTable)) {
      const current = parents.get(relationship.sourceTable) ?? [];
      current.push(relationship.targetTable);
      parents.set(relationship.sourceTable, current);
    }
  }
  const cache = new Map<string, number>();
  function getLevel(name: string, path = new Set<string>()): number {
    const cached = cache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    if (path.has(name)) {
      return 0;
    }
    const nextPath = new Set(path);
    nextPath.add(name);
    const tableParents = parents.get(name) ?? [];
    if (tableParents.length === 0) {
      cache.set(name, 0);
      return 0;
    }
    const level = Math.max(...tableParents.map((parent) => getLevel(parent, nextPath))) + 1;
    cache.set(name, level);
    return level;
  }
  return tables.map((table) => ({
    table,
    level: getLevel(table.name),
  }));
}
function AdminDatabaseMap({ tables = [], relationships = [] }: AdminDatabaseMapProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [lines, setLines] = useState<MapLine[]>([]);
  const nodes = useMemo(() => calculateLevels(tables, relationships), [tables, relationships]);
  const levels = useMemo(() => {
    const result = new Map<number, MapNode[]>();
    for (const node of nodes) {
      const current = result.get(node.level) ?? [];
      current.push(node);
      result.set(node.level, current);
    }
    return [...result.entries()].sort(([left], [right]) => left - right);
  }, [nodes]);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    function updateLines() {
      const currentCanvas = canvasRef.current;

      if (!currentCanvas) {
        return;
      }

      const canvasRect = currentCanvas.getBoundingClientRect();

      const nextLines = relationships.flatMap<MapLine>((relationship) => {
        const source = nodeRefs.current.get(relationship.sourceTable);
        const target = nodeRefs.current.get(relationship.targetTable);

        if (!source || !target) {
          return [];
        }

        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        return [
          {
            key: relationship.constraintName,
            x1: targetRect.right - canvasRect.left,
            y1: targetRect.top + targetRect.height / 2 - canvasRect.top,
            x2: sourceRect.left - canvasRect.left,
            y2: sourceRect.top + sourceRect.height / 2 - canvasRect.top,
          },
        ];
      });
      setLines(nextLines);
    }
    updateLines();
    const observer = new ResizeObserver(updateLines);
    observer.observe(canvas);
    window.addEventListener('resize', updateLines);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLines);
    };
  }, [relationships, levels]);
  return (
    <section className="admin-section admin-database-map">
      <div className="admin-section-header">
        <div>
          <span className="admin-section-eyebrow">SCHEMA</span>
          <h2>Database Map</h2>
          <p>Application tables and their foreign-key relationships.</p>
        </div>
        <span className="admin-database-map-count">{relationships.length} relationships</span>
      </div>
      <div className="admin-database-map-canvas" ref={canvasRef}>
        <svg className="admin-database-map-lines" aria-hidden="true">
          {lines.map((line) => {
            const midpoint = line.x1 + (line.x2 - line.x1) / 2;
            return (
              <path
                key={line.key}
                d={`M ${line.x1} ${line.y1}
                    C ${midpoint} ${line.y1},
                      ${midpoint} ${line.y2},
                      ${line.x2} ${line.y2}`}
              />
            );
          })}
        </svg>
        <div
          className="admin-database-map-levels"
          style={{
            gridTemplateColumns: `repeat(${Math.max(levels.length, 1)}, minmax(150px, 1fr))`,
          }}
        >
          {levels.map(([level, levelNodes]) => (
            <div className="admin-database-map-level" key={level}>
              {levelNodes.map(({ table }) => (
                <Link
                  className="admin-database-map-node"
                  key={table.name}
                  to={`/admin/database/tables/${encodeURIComponent(table.name)}`}
                  ref={(element) => {
                    if (element) {
                      nodeRefs.current.set(table.name, element);
                    } else {
                      nodeRefs.current.delete(table.name);
                    }
                  }}
                >
                  <strong>{table.name}</strong>

                  <div>
                    <span>{formatNumber(table.estimatedRows)} rows</span>
                    <span>{formatBytes(table.totalSizeBytes)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export default AdminDatabaseMap;
