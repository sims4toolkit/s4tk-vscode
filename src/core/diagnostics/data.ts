interface _DiagnoticsData {
  bitLimits: {
    bits: number;
    classes: Set<string>;
  }[];

  requiredSimData: Map<string, Set<string>>;
}

function _loadDiagnosticsData(): _DiagnoticsData {
  const raw = require("../../../data/diagnostics.json");

  raw.bitLimits.forEach((bitLimit: any) => {
    bitLimit.classes = new Set(bitLimit.classes);
  });

  const requiredSimDataMap = new Map<string, Set<string>>();
  for (const typeName in raw.requiredSimData) {
    const classNames = raw.requiredSimData[typeName];
    requiredSimDataMap.set(typeName, new Set(classNames));
  }
  raw.requiredSimData = requiredSimDataMap;

  return raw as _DiagnoticsData;
}

const DiagnoticsData = _loadDiagnosticsData();
export default DiagnoticsData;
