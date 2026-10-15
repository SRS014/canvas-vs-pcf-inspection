// Creates the publisher, solution, choices, tables, columns and relationships in
// schema.json. Safe to re-run: anything that already exists is left alone.
//
//   DATAVERSE_URL=https://yourorg.crm.dynamics.com npm run provision
import { connect, label, logical, readJson } from "./dataverse.mjs";

const schema = readJson("schema.json");

const required = (isRequired) => ({
  Value: isRequired ? "ApplicationRequired" : "None",
  CanBeChanged: true,
  ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings",
});

function columnBody(col, optionSetIds) {
  const common = {
    SchemaName: col.schemaName,
    DisplayName: label(col.displayName),
    Description: label(col.description ?? ""),
    RequiredLevel: required(col.required),
  };
  const t = (name) => ({ "@odata.type": `Microsoft.Dynamics.CRM.${name}`, ...common });
  switch (col.type) {
    case "string":
      return {
        ...t("StringAttributeMetadata"),
        MaxLength: col.maxLength,
        FormatName: { Value: "Text" },
        ...(col.autoNumberFormat ? { AutoNumberFormat: col.autoNumberFormat } : {}),
      };
    case "memo":
      return { ...t("MemoAttributeMetadata"), MaxLength: col.maxLength, Format: "TextArea" };
    case "integer":
      return { ...t("IntegerAttributeMetadata"), MinValue: col.min, MaxValue: col.max, Format: "None" };
    case "decimal":
      return { ...t("DecimalAttributeMetadata"), MinValue: col.min, MaxValue: col.max, Precision: col.precision };
    case "boolean":
      return {
        ...t("BooleanAttributeMetadata"),
        DefaultValue: false,
        OptionSet: {
          "@odata.type": "Microsoft.Dynamics.CRM.BooleanOptionSetMetadata",
          OptionSetType: "Boolean",
          TrueOption: { Value: 1, Label: label("Yes") },
          FalseOption: { Value: 0, Label: label("No") },
        },
      };
    case "datetime":
      return { ...t("DateTimeAttributeMetadata"), Format: "DateAndTime", DateTimeBehavior: { Value: "UserLocal" } };
    case "choice":
      return { ...t("PicklistAttributeMetadata"), "GlobalOptionSet@odata.bind": `/GlobalOptionSetDefinitions(${optionSetIds[col.optionSet]})` };
    case "image":
      return { ...t("ImageAttributeMetadata"), IsPrimaryImage: !!col.primary, MaxSizeInKB: col.maxSizeInKB, CanStoreFullImage: true };
    default:
      throw new Error(`Unknown column type ${col.type} on ${col.schemaName}`);
  }
}

async function main() {
  const { url, api } = await connect({ solution: schema.solution.uniquename });
  console.log(`Connected to ${url}`);

  // Publisher and solution
  const p = schema.publisher;
  let publisher = (await api("GET", `publishers?$select=publisherid,customizationprefix&$filter=uniquename eq '${p.uniquename}'`)).value[0];
  if (!publisher) {
    const created = await api("POST", "publishers", p);
    publisher = { publisherid: created["@entityId"], customizationprefix: p.customizationprefix };
    console.log(`+ publisher ${p.uniquename}`);
  } else if (publisher.customizationprefix !== p.customizationprefix) {
    throw new Error(`Publisher ${p.uniquename} exists with prefix ${publisher.customizationprefix}, expected ${p.customizationprefix}.`);
  }
  const s = schema.solution;
  const solutions = await api("GET", `solutions?$select=solutionid&$filter=uniquename eq '${s.uniquename}'`);
  if (!solutions.value.length) {
    await api("POST", "solutions", {
      uniquename: s.uniquename,
      friendlyname: s.friendlyname,
      version: s.version,
      "publisherid@odata.bind": `/publishers(${publisher.publisherid})`,
    });
    console.log(`+ solution ${s.uniquename}`);
  }

  // Global choices
  const optionSetIds = {};
  for (const os of schema.optionSets) {
    let existing = await api("GET", `GlobalOptionSetDefinitions(Name='${os.name}')?$select=MetadataId`, undefined, { allow404: true });
    if (!existing) {
      await api("POST", "GlobalOptionSetDefinitions", {
        "@odata.type": "Microsoft.Dynamics.CRM.OptionSetMetadata",
        Name: os.name,
        DisplayName: label(os.displayName),
        OptionSetType: "Picklist",
        IsGlobal: true,
        Options: os.options.map((o) => ({ Value: o.value, Label: label(o.label) })),
      });
      existing = await api("GET", `GlobalOptionSetDefinitions(Name='${os.name}')?$select=MetadataId`);
      console.log(`+ choice ${os.name}`);
    }
    optionSetIds[os.name] = existing.MetadataId;
  }

  // Tables and columns
  for (const table of schema.tables) {
    const name = logical(table.schemaName);
    const exists = await api("GET", `EntityDefinitions(LogicalName='${name}')?$select=LogicalName`, undefined, { allow404: true });
    if (!exists) {
      await api("POST", "EntityDefinitions", {
        "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
        SchemaName: table.schemaName,
        DisplayName: label(table.displayName),
        DisplayCollectionName: label(table.pluralName),
        Description: label(table.description),
        OwnershipType: "UserOwned",
        IsActivity: false,
        HasActivities: false,
        HasNotes: false,
        Attributes: [{ ...columnBody({ type: "string", required: true, ...table.primaryName }, optionSetIds), IsPrimaryName: true }],
      });
      console.log(`+ table ${name}`);
    }
    for (const col of table.columns) {
      const colName = logical(col.schemaName);
      const has = await api("GET", `EntityDefinitions(LogicalName='${name}')/Attributes(LogicalName='${colName}')?$select=LogicalName`, undefined, { allow404: true });
      if (has) continue;
      await api("POST", `EntityDefinitions(LogicalName='${name}')/Attributes`, columnBody(col, optionSetIds));
      console.log(`  + ${name}.${colName}`);
    }
  }

  // Lookups
  for (const rel of schema.relationships) {
    const has = await api("GET", `RelationshipDefinitions(SchemaName='${rel.schemaName}')?$select=SchemaName`, undefined, { allow404: true });
    if (has) continue;
    await api("POST", "RelationshipDefinitions", {
      "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
      SchemaName: rel.schemaName,
      ReferencedEntity: rel.referenced,
      ReferencingEntity: rel.referencing,
      CascadeConfiguration: {
        Assign: "NoCascade",
        Delete: rel.deleteBehavior,
        Merge: "NoCascade",
        Reparent: "NoCascade",
        Share: "NoCascade",
        Unshare: "NoCascade",
        RollupView: "NoCascade",
      },
      Lookup: {
        "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
        SchemaName: rel.lookupSchemaName,
        DisplayName: label(rel.lookupDisplayName),
        RequiredLevel: required(false),
      },
    });
    console.log(`+ lookup ${rel.referencing}.${logical(rel.lookupSchemaName)} -> ${rel.referenced}`);
  }

  // Publish
  const entities = schema.tables.map((t) => `<entity>${logical(t.schemaName)}</entity>`).join("");
  const optionSets = schema.optionSets.map((o) => `<optionset>${o.name}</optionset>`).join("");
  await api("POST", "PublishXml", {
    ParameterXml: `<importexportxml><entities>${entities}</entities><optionsets>${optionSets}</optionsets></importexportxml>`,
  });
  console.log("Published. Schema is ready.");
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
