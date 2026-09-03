import type { CatalogueAdapter, DatasetRecord, DatasetStructure, InspectOptions } from '../types';
import { normalizeOdsDataset } from './normalize';
import { structureFromCatalogEntry } from './ods-structure';

/**
 * Offline fallback set.
 *
 * These are real Basel-Stadt catalogue entries captured from
 * `https://data.bs.ch/api/explore/v2.1/catalog/datasets` on 2026-09-02 (descriptions
 * truncated to 400 characters, field annotations trimmed to the structural ones).
 * The set is chosen to cover all six benchmark use cases, including the
 * datasets that are published with zero records. Freezing genuine source shapes keeps
 * the fallback honest: it exercises the same normalizer, the same structure
 * builder and the same compatibility rules as live data.
 *
 * Fallback mode is never presented as live. What it cannot do is reach
 * `sample_records` evidence, so the adapter deliberately declines value-level
 * key validation instead of inventing it.
 */
const FALLBACK_ENTRIES: unknown[] = [
  {
    "dataset_id": "100006",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "zst_nr",
        "type": "int",
        "label": "ZST_NR (Text)",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "zst_id",
        "type": "int",
        "label": "ZST_NR (numerisch)"
      },
      {
        "name": "sitecode",
        "type": "text",
        "label": "SiteCode"
      },
      {
        "name": "sitename",
        "type": "text",
        "label": "SiteName",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "datetimefrom",
        "type": "datetime",
        "label": "DateTimeFrom",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "datetimeto",
        "type": "datetime",
        "label": "DateTimeTo",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "directionname",
        "type": "text",
        "label": "DirectionName",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "lanecode",
        "type": "int",
        "label": "LaneCode",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "lanename",
        "type": "text",
        "label": "LaneName",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "valuesapproved",
        "type": "int",
        "label": "ValuesApproved",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "valuesedited",
        "type": "int",
        "label": "ValuesEdited",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "traffictype",
        "type": "text",
        "label": "TrafficType"
      },
      {
        "name": "total",
        "type": "int",
        "label": "Total"
      },
      {
        "name": "mr",
        "type": "int",
        "label": "MR"
      },
      {
        "name": "pw",
        "type": "int",
        "label": "PW"
      },
      {
        "name": "pw0",
        "type": "int",
        "label": "PW+"
      },
      {
        "name": "lief",
        "type": "int",
        "label": "Lief"
      },
      {
        "name": "lief0",
        "type": "int",
        "label": "Lief+"
      },
      {
        "name": "lief_aufl",
        "type": "int",
        "label": "Lief+Aufl."
      },
      {
        "name": "lw",
        "type": "int",
        "label": "LW"
      },
      {
        "name": "lw0",
        "type": "int",
        "label": "LW+"
      },
      {
        "name": "sattelzug",
        "type": "int",
        "label": "Sattelzug"
      },
      {
        "name": "bus",
        "type": "int",
        "label": "Bus"
      },
      {
        "name": "andere",
        "type": "int",
        "label": "andere"
      },
      {
        "name": "year",
        "type": "text",
        "label": "Year",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "month",
        "type": "int",
        "label": "Month",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "day",
        "type": "int",
        "label": "Day",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "weekday",
        "type": "int",
        "label": "Weekday",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "hourfrom",
        "type": "int",
        "label": "HourFrom"
      },
      {
        "name": "date",
        "type": "text",
        "label": "Date"
      },
      {
        "name": "timefrom",
        "type": "text",
        "label": "TimeFrom",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "timeto",
        "type": "text",
        "label": "TimeTo"
      },
      {
        "name": "dayofyear",
        "type": "int",
        "label": "DayOfYear"
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      }
    ],
    "metas": {
      "default": {
        "title": "Verkehrszähldaten motorisierter Individualverkehr",
        "title_en": "Verkehrszähldaten motorisierter Individualverkehr",
        "description": "<p>Resultate der Messungen der Dauerzählstellen und Kurzzeitzählstellen für den Motorisierten Individualverkehr. </p><p>Aus Kostengründen sind nur die Werte des aktuellen Jahres und der letzten zwei Jahre als Tabelle / Visualisierung sichtbar bzw. via API abgreifbar. </p><p>Die Zählstellen, die zwischen allen Fahrzeugklassen unterscheiden können, ab dem Jahr 2014 können hier heruntergeladen werden",
        "theme": [
          "Mobilität und Verkehr",
          "Tourismus"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Tourism"
        ],
        "keyword": [
          "Autos",
          "Motorräder",
          "Busse",
          "Lieferwagen",
          "Lastwagen",
          "Anhänger",
          "Verkehr",
          "Verkehrszählung",
          "Erhebung"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T07:31:48.260000+00:00",
        "records_count": 1897440,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.655596928671002,
                  47.595263994298875
                ],
                [
                  7.562359739094973,
                  47.595263994298875
                ],
                [
                  7.562359739094973,
                  47.54255498293787
                ],
                [
                  7.655596928671002,
                  47.54255498293787
                ],
                [
                  7.655596928671002,
                  47.595263994298875
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität",
        "territory": [
          "Basel-Stadt",
          "Baden-Württemberg"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/DAILY",
        "temporal_coverage_start": "2023-12-30T23:00:00+00:00",
        "temporal_coverage_end": "2026-08-29T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100008",
    "has_records": true,
    "features": [
      "geo",
      "image"
    ],
    "fields": [
      {
        "name": "name",
        "type": "text",
        "label": "Name"
      },
      {
        "name": "desc",
        "type": "text",
        "label": "Description"
      },
      {
        "name": "gx_media_links",
        "type": "file",
        "label": "Picture"
      },
      {
        "name": "picture_link",
        "type": "text",
        "label": "picture_link"
      },
      {
        "name": "geometry",
        "type": "geo_shape",
        "label": "Geometry"
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "geo_point_2d"
      }
    ],
    "metas": {
      "default": {
        "title": "Bade-, Trinkwasser- und Zierbrunnen in Basel",
        "title_en": "Bade-, Trinkwasser- und Zierbrunnen in Basel",
        "description": "<p>In der Stadt Basel betreibt IWB über 200 öffentliche Brunnen. Sie sind Kulturgut und «Visitenkarte» der Stadt: <a href=\"https://www.iwb.ch/klimadreh/ratgeber/sauberes-trinkwasser/die-geschichte-der-basler-brunnen\" target=\"_blank\">https://www.iwb.ch/klimadreh/ratgeber/sauberes-trinkwasser/die-geschichte-der-basler-brunnen</a><a href=\"https://www.iwb.ch/klimadreh/ratgeber/sauberes-trinkwasser/die",
        "theme": [
          "Kultur, Medien, Informationsgesellschaft, Sport",
          "Tourismus"
        ],
        "theme_en": [
          "Culture, media, information society, sport",
          "Tourism"
        ],
        "keyword": [
          "Brunnen",
          "Wasser",
          "Trinkwasser",
          "Baden"
        ],
        "license": "Freie Nutzung. Quellenangabe ist Pflicht. Kommerzielle Nutzung nur mit Bewilligung des Datenlieferanten zulässig.",
        "license_url": "https://opendata.swiss/de/terms-of-use/",
        "modified": "2026-09-01T22:03:25.911000+00:00",
        "records_count": 305,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.6301309466362,
                  47.58377378806472
                ],
                [
                  7.5573531445115805,
                  47.58377378806472
                ],
                [
                  7.5573531445115805,
                  47.52827666234225
                ],
                [
                  7.6301309466362,
                  47.52827666234225
                ],
                [
                  7.6301309466362,
                  47.58377378806472
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Industrielle Werke Basel",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG"
      }
    }
  },
  {
    "dataset_id": "100009",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "name_original",
        "type": "text",
        "label": "Station-ID",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "name_custom",
        "type": "text",
        "label": "Name",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "dates_max_date",
        "type": "datetime",
        "label": "Zeitstempel",
        "annotations": {
          "facet": true,
          "timeserie_precision": "minute"
        }
      },
      {
        "name": "meta_airtemp",
        "type": "double",
        "label": "Lufttemperatur",
        "annotations": {
          "unit": "°C"
        }
      },
      {
        "name": "meta_rain_1h_val",
        "type": "double",
        "label": "Regen in 1 h",
        "annotations": {
          "unit": "mm"
        }
      },
      {
        "name": "meta_rain24h_sum",
        "type": "double",
        "label": "Regen in 24 h",
        "annotations": {
          "unit": "mm"
        }
      },
      {
        "name": "meta_rain48h_sum",
        "type": "double",
        "label": "Regen in 48 h",
        "annotations": {
          "unit": "mm"
        }
      },
      {
        "name": "coords",
        "type": "geo_point_2d",
        "label": "Koordinaten"
      },
      {
        "name": "stadtklima_basel_link",
        "type": "text",
        "label": "Stadtklima Basel Link"
      },
      {
        "name": "unix_timestamp",
        "type": "int",
        "label": "Unix Zeitstempel"
      }
    ],
    "metas": {
      "default": {
        "title": "Smart Climate Luftklima",
        "title_en": "Smart Climate Luftklima",
        "description": "<p>Der Datensatz zeigt stündlich aktualisierte Angaben zu Lufttemperatur und Niederschlag, welche über Sensoren von meteoblue gemessen werden. </p><p>Es handelt sich um Rohdaten, welche nicht plausibilisiert oder korrigiert sind.</p><p>Die geografischen Koordinaten der Sensoren sind im Datensatz <a href=\"https://data.bs.ch/explore/dataset/100082/\" target=\"_blank\">«Standorte der Mess-Stationen Luft",
        "theme": [
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Territory and environment"
        ],
        "keyword": [
          "Wetter",
          "Temperatur",
          "Regen",
          "Niederschlag",
          "Sensoren",
          "Klima",
          "Wolf-Areal",
          "Smart City Lab"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T20:11:10.262000+00:00",
        "records_count": 6762073,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.714859917759895,
                  47.63169698417187
                ],
                [
                  7.523119943216443,
                  47.63169698417187
                ],
                [
                  7.523119943216443,
                  47.46800998225808
                ],
                [
                  7.714859917759895,
                  47.46800998225808
                ],
                [
                  7.714859917759895,
                  47.63169698417187
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "meteoblue AG",
        "territory": [
          "World"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/DAILY",
        "temporal_coverage_start": "2017-03-31T22:00:00+00:00",
        "temporal_coverage_end": "2026-09-01T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100013",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "calendar",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "zst_nr",
        "type": "text",
        "label": "ZST_NR (Text)",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "zst_id",
        "type": "int",
        "label": "ZST_NR (numerisch)"
      },
      {
        "name": "sitecode",
        "type": "text",
        "label": "SiteCode"
      },
      {
        "name": "sitename",
        "type": "text",
        "label": "SiteName",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "datetimefrom",
        "type": "datetime",
        "label": "DateTimeFrom",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "datetimeto",
        "type": "datetime",
        "label": "DateTimeTo",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "directionname",
        "type": "text",
        "label": "DirectionName",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "lanecode",
        "type": "int",
        "label": "LaneCode",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "lanename",
        "type": "text",
        "label": "LaneName",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "valuesapproved",
        "type": "int",
        "label": "ValuesApproved",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "valuesedited",
        "type": "int",
        "label": "ValuesEdited",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "traffictype",
        "type": "text",
        "label": "TrafficType",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "total",
        "type": "int",
        "label": "Total"
      },
      {
        "name": "year",
        "type": "text",
        "label": "Year",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "month",
        "type": "int",
        "label": "Month",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "day",
        "type": "int",
        "label": "Day",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "weekday",
        "type": "int",
        "label": "Weekday",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "hourfrom",
        "type": "int",
        "label": "HourFrom"
      },
      {
        "name": "date",
        "type": "text",
        "label": "Date"
      },
      {
        "name": "timefrom",
        "type": "text",
        "label": "TimeFrom",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "timeto",
        "type": "text",
        "label": "TimeTo"
      },
      {
        "name": "dayofyear",
        "type": "int",
        "label": "DayOfYear"
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      }
    ],
    "metas": {
      "default": {
        "title": "Verkehrszähldaten Velos und Fussgänger",
        "title_en": "Verkehrszähldaten Velos und Fussgänger",
        "description": "<p>Resultate der Messungen der Dauerzählstellen und Kurzzeitzählstellen für den Velo- und Fussgängerverkehr. </p><p>Die Zähldaten für den Fussgängerverkehr werden monatlich durch Anwendung einer Korrekturfunktion angepasst und im Anschluss veröffentlicht.</p><p>Aus Kostengründen sind nur die Werte des aktuellen und des letzten Jahres als Tabelle / Visualisierung sichtbar bzw. via API abgreifbar. <",
        "theme": [
          "Mobilität und Verkehr",
          "Tourismus"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Tourism"
        ],
        "keyword": [
          "Verkehr",
          "Verkehrszählung",
          "Erhebung",
          "Fussgänger",
          "Fussverkehr",
          "Velo",
          "Fahrrad"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T07:34:39.993000+00:00",
        "records_count": 2334312,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.650566194206476,
                  47.58572966326028
                ],
                [
                  7.55978599190712,
                  47.58572966326028
                ],
                [
                  7.55978599190712,
                  47.53708801232278
                ],
                [
                  7.650566194206476,
                  47.53708801232278
                ],
                [
                  7.650566194206476,
                  47.58572966326028
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität",
        "territory": [
          "Riehen",
          "Basel"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/DAILY",
        "temporal_coverage_start": "2023-12-30T23:00:00+00:00",
        "temporal_coverage_end": "2026-08-29T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100018",
    "has_records": true,
    "features": [
      "geo",
      "analyze",
      "timeserie",
      "custom_view"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "begehrenid",
        "type": "int",
        "label": "BegehrenID"
      },
      {
        "name": "lokalitaid",
        "type": "int",
        "label": "LokalitätID"
      },
      {
        "name": "belegungid",
        "type": "int",
        "label": "BelegungID"
      },
      {
        "name": "bezeichng",
        "type": "text",
        "label": "Bezeichnung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "artbeg_id",
        "type": "int",
        "label": "BegehrensartID"
      },
      {
        "name": "artbeg_bez",
        "type": "text",
        "label": "Begehrensart-Bezeichnung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "eingangsdatum",
        "type": "date",
        "label": "Eingangsdatum",
        "annotations": {
          "timeserie_precision": "day",
          "facet": true
        }
      },
      {
        "name": "entscheid_datum",
        "type": "date",
        "label": "Entscheid-Datum",
        "annotations": {
          "timeserie_precision": "day",
          "facet": true
        }
      },
      {
        "name": "entsch_id",
        "type": "int",
        "label": "EntscheidID"
      },
      {
        "name": "entsch_bez",
        "type": "text",
        "label": "Entscheid-Bezeichnung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "strassenid",
        "type": "int",
        "label": "StrassenID"
      },
      {
        "name": "belgartid",
        "type": "int",
        "label": "BelegungsartID"
      },
      {
        "name": "belgartbez",
        "type": "text",
        "label": "Belegungsart-Bezeichnung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "belaartid",
        "type": "int",
        "label": "BelastungsartID"
      },
      {
        "name": "belaartbez",
        "type": "text",
        "label": "Belastungsart-Bezeichnung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "merkmal_id",
        "type": "int",
        "label": "MerkmalID"
      },
      {
        "name": "merkmalbez",
        "type": "text",
        "label": "Geschäftsmerkmal-Bezeichnung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "merkmalwrt",
        "type": "text",
        "label": "MerkmalWert"
      },
      {
        "name": "einheit_id",
        "type": "int",
        "label": "EinheitID"
      },
      {
        "name": "einheitbez",
        "type": "text",
        "label": "Belegungseinheit-Bezeichnung"
      },
      {
        "name": "belestatid",
        "type": "int",
        "label": "BelegungsstatusID"
      },
      {
        "name": "belestatbe",
        "type": "text",
        "label": "Belegungsstatus-Bezeichung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "idunique",
        "type": "text",
        "label": "IDUnique"
      },
      {
        "name": "datumeing",
        "type": "text",
        "label": "DatumEing"
      },
      {
        "name": "datuments",
        "type": "text",
        "label": "DatumEnts"
      },
      {
        "name": "datum_von",
        "type": "date",
        "label": "Datum_von",
        "annotations": {
          "timeserie_precision": "day",
          "facet": true
        }
      },
      {
        "name": "datum_bis",
        "type": "date",
        "label": "Datum_bis",
        "annotations": {
          "timeserie_precision": "day",
          "facet": true
        }
      }
    ],
    "metas": {
      "default": {
        "title": "Allmendbewilligungen",
        "title_en": "Allmend permits",
        "description": "Allmendbewilligungen beinhaltet sämtliche Nutzungen, welche im öffentlichen Raum (Allmend) stattfinden. Die dargestellten genutzten Flächen sind nicht verbindlich.",
        "theme": [
          "Öffentliche Ordnung und Sicherheit",
          "Bau- und Wohnungswesen",
          "Geographie"
        ],
        "theme_en": [
          "Public order and security",
          "Construction and housing",
          "Geography"
        ],
        "keyword": [
          "Baustelle",
          "Plakat",
          "Anlass",
          "Fest",
          "Party",
          "Umleitung"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2026-09-02T00:00:00+00:00",
        "records_count": 260350,
        "geometry_types": [
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.693807007744908,
                  47.60078775230795
                ],
                [
                  7.555172676220536,
                  47.60078775230795
                ],
                [
                  7.555172676220536,
                  47.519766725599766
                ],
                [
                  7.693807007744908,
                  47.519766725599766
                ],
                [
                  7.693807007744908,
                  47.60078775230795
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Tiefbauamt"
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/DAILY",
        "temporal_coverage_start": "1950-08-08T23:00:00+00:00",
        "temporal_coverage_end": "5025-04-29T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100029",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "sc_schulstandort",
        "type": "text",
        "label": "Schulstandort",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "sc_schultyp",
        "type": "text",
        "label": "Schultyp",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "sc_adresse",
        "type": "text",
        "label": "Adresse",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "mapbs_sc_link",
        "type": "text",
        "label": "Link"
      },
      {
        "name": "map_links",
        "type": "text",
        "label": "Map Links"
      }
    ],
    "metas": {
      "default": {
        "title": "Schulstandorte (Gemeinde Basel)",
        "title_en": "Schulstandorte (Gemeinde Basel)",
        "description": "Die Karte zeigt die Schulstandorte (Kindergärten, Primar-, Sekundarschule, Gymnasium, Zentrum für Brückenangebote, Allgemeine Gewerbeschule, Fachmaturitätsschule, Spezialangebote sowie Tagesstrukturen, Sportplätze, Turnhallen ausserhalb von Schulstandorten und Schwimmhallen) der Gemeinde Basel.",
        "theme": [
          "Bildung, Wissenschaft",
          "Bevölkerung",
          "Geographie"
        ],
        "theme_en": [
          "Education and science",
          "Population",
          "Geography"
        ],
        "keyword": [
          "Schule",
          "Lernen",
          "Schüler",
          "Schülerinnen",
          "Lehrer",
          "Lehrerinnen"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2026-06-30T00:00:00+00:00",
        "records_count": 415,
        "geometry_types": [
          "Point",
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.631650920957327,
                  47.58351181168109
                ],
                [
                  7.554121753200889,
                  47.58351181168109
                ],
                [
                  7.554121753200889,
                  47.52750938292593
                ],
                [
                  7.631650920957327,
                  47.52750938292593
                ],
                [
                  7.631650920957327,
                  47.58351181168109
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Zentrale Dienste",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/ANNUAL_2"
      }
    }
  },
  {
    "dataset_id": "100030",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "id_schule",
        "type": "int",
        "label": "ID_SCHULE"
      },
      {
        "name": "standort",
        "type": "text",
        "label": "Schulstandort",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "typ",
        "type": "text",
        "label": "Schultyp",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "name",
        "type": "text",
        "label": "Name der Schule",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "telefon1",
        "type": "text",
        "label": "Telefon Kontaktperson 1"
      },
      {
        "name": "telefon2",
        "type": "text",
        "label": "Telefon Kontaktperson 2"
      },
      {
        "name": "strasse",
        "type": "text",
        "label": "Strasse",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "hausnummer",
        "type": "text",
        "label": "Hausnummer"
      },
      {
        "name": "plz",
        "type": "text",
        "label": "PLZ",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "ort",
        "type": "text",
        "label": "Ortschaft",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "fax",
        "type": "text",
        "label": "Fax"
      },
      {
        "name": "link",
        "type": "text",
        "label": "Link"
      },
      {
        "name": "geometrie",
        "type": "text",
        "label": "Geometrie"
      },
      {
        "name": "map_links",
        "type": "text",
        "label": "Map Links"
      }
    ],
    "metas": {
      "default": {
        "title": "Schulstandorte (Gemeinden Riehen und Bettingen)",
        "title_en": "Schulstandorte (Gemeinden Riehen und Bettingen)",
        "description": "Schulstandorte der Primarstufe (Gemeinden Riehen und Bettingen)",
        "theme": [
          "Bildung, Wissenschaft",
          "Bevölkerung",
          "Geographie"
        ],
        "theme_en": [
          "Education and science",
          "Population",
          "Geography"
        ],
        "keyword": [
          "Schule",
          "Lernen",
          "Schüler",
          "Schülerinnen",
          "Lehrer",
          "Lehrerinnen"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2026-09-01T00:00:00+00:00",
        "records_count": 37,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.666565738618374,
                  47.5935565168038
                ],
                [
                  7.63280862942338,
                  47.5935565168038
                ],
                [
                  7.63280862942338,
                  47.57027758285403
                ],
                [
                  7.666565738618374,
                  47.57027758285403
                ],
                [
                  7.666565738618374,
                  47.5935565168038
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Gemeinde Riehen",
        "territory": [
          "Riehen",
          "Bettingen"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG"
      }
    }
  },
  {
    "dataset_id": "100032",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "objid",
        "type": "text",
        "label": "OBJID"
      },
      {
        "name": "objectid",
        "type": "int",
        "label": "OBJECTID"
      },
      {
        "name": "informatio",
        "type": "text",
        "label": "INFORMATIO"
      },
      {
        "name": "kategorie",
        "type": "text",
        "label": "KATEGORIE"
      },
      {
        "name": "routenbez",
        "type": "text",
        "label": "ROUTENBEZ"
      },
      {
        "name": "rbeschreib",
        "type": "text",
        "label": "RBESCHREIB"
      },
      {
        "name": "richtung",
        "type": "text",
        "label": "RICHTUNG"
      },
      {
        "name": "shape_leng",
        "type": "double",
        "label": "SHAPE_LENG"
      }
    ],
    "metas": {
      "default": {
        "title": "Alltagsvelorouten",
        "title_en": "Alltagsvelorouten",
        "description": "Die Alltagsvelorouten zeigen in Basel-Stadt und in der näheren Umgebung die rot signalisierten Velorouten ohne Nummern. Sie leiten den Alltagsvelofahrenden zu den wichtigsten Zielen in der Stadt.",
        "theme": [
          "Mobilität und Verkehr",
          "Geographie",
          " Tourismus"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Geography",
          " Tourismus"
        ],
        "keyword": [
          "Velo",
          "Fahrrad",
          "Veloweg",
          "E-Bike",
          "Pedelec"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2025-02-10T13:49:36.886000+00:00",
        "records_count": 21,
        "geometry_types": [
          "LineString"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.657114723697305,
                  47.59597146883607
                ],
                [
                  7.5569196324795485,
                  47.59597146883607
                ],
                [
                  7.5569196324795485,
                  47.53042351920158
                ],
                [
                  7.657114723697305,
                  47.53042351920158
                ],
                [
                  7.657114723697305,
                  47.59597146883607
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität"
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG"
      }
    }
  },
  {
    "dataset_id": "100033",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "objid",
        "type": "text",
        "label": "OBJID"
      },
      {
        "name": "objectid",
        "type": "int",
        "label": "OBJECTID"
      },
      {
        "name": "informatio",
        "type": "text",
        "label": "INFORMATIO"
      },
      {
        "name": "kategorie",
        "type": "text",
        "label": "KATEGORIE"
      },
      {
        "name": "routenbez",
        "type": "text",
        "label": "ROUTENBEZ"
      },
      {
        "name": "rbeschreib",
        "type": "text",
        "label": "RBESCHREIB"
      },
      {
        "name": "richtung",
        "type": "text",
        "label": "RICHTUNG"
      },
      {
        "name": "shape_leng",
        "type": "double",
        "label": "SHAPE_LENG"
      }
    ],
    "metas": {
      "default": {
        "title": "Touristische Velorouten",
        "title_en": "Touristische Velorouten",
        "description": "Die touristischen Velorouten zeigen in Basel-Stadt und in der näheren Umgebung die signalisierten Velorouten von EuroVelo und SchweizMobil sowie die signalisierten regionalen Velorouten wie der Südschwarzwald-Radweg und der Dreiland-Radweg.",
        "theme": [
          "Tourismus",
          "Mobilität und Verkehr",
          "Geographie"
        ],
        "theme_en": [
          "Tourism",
          "Mobility and Transport",
          "Geography"
        ],
        "keyword": [
          "Velo",
          "Fahrrad",
          "Veloweg",
          "E-Bike",
          "Pedelec"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2024-10-08T11:23:40.424000+00:00",
        "records_count": 29,
        "geometry_types": [
          "LineString"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.733180578798056,
                  47.65947482082993
                ],
                [
                  7.495888648554683,
                  47.65947482082993
                ],
                [
                  7.495888648554683,
                  47.499110153876245
                ],
                [
                  7.733180578798056,
                  47.499110153876245
                ],
                [
                  7.733180578798056,
                  47.65947482082993
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität"
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG"
      }
    }
  },
  {
    "dataset_id": "100038",
    "has_records": true,
    "features": [
      "geo",
      "analyze",
      "timeserie"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "id_zst",
        "type": "text",
        "label": "ID_ZST"
      },
      {
        "name": "name",
        "type": "text",
        "label": "NAME",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "gemeinde",
        "type": "text",
        "label": "GEMEINDE",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "klasse",
        "type": "text",
        "label": "KLASSE",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "kombiniert",
        "type": "text",
        "label": "KOMBINIERT",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "art",
        "type": "text",
        "label": "ART",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "arme",
        "type": "double",
        "label": "ARME",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "fahrstreif",
        "type": "double",
        "label": "FAHRSTREIF",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "zweck",
        "type": "text",
        "label": "ZWECK",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "typ",
        "type": "text",
        "label": "TYP",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "strtyp",
        "type": "text",
        "label": "STRTYP",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "eigentum",
        "type": "text",
        "label": "EIGENTUM",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "betriebnah",
        "type": "datetime",
        "label": "BETRIEBNAH",
        "annotations": {
          "facet": true,
          "timeserie_precision": "hour"
        }
      },
      {
        "name": "betriebzus",
        "type": "text",
        "label": "BETRIEBZUS",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "link",
        "type": "text",
        "label": "LINK"
      },
      {
        "name": "format",
        "type": "text",
        "label": "FORMAT"
      }
    ],
    "metas": {
      "default": {
        "title": "Standorte der Zählstellen für Verkehrszähldaten",
        "title_en": "Standorte der Zählstellen für Verkehrszähldaten",
        "description": "Standorte der Dauerzählstellen für den motorisierten Individualverkehr (MIV) mit eigens für die Zählung installierten Induktionsschleifen und an den Induktionsschleifen von Lichtsignalanlagen (LSA). Zusätzlich die Standorte der Fussgänger- und Velozählstellen sowie der Kurzzeitzählstellen.",
        "theme": [
          "Mobilität und Verkehr",
          "Geographie"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Geography"
        ],
        "keyword": [
          "Auto",
          "Velo",
          "Fussgänger",
          "Lastwagen",
          "LKW",
          "Anhänger"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2025-04-10T00:00:00+00:00",
        "records_count": 351,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.672031661495566,
                  47.602062094956636
                ],
                [
                  7.5370629876852036,
                  47.602062094956636
                ],
                [
                  7.5370629876852036,
                  47.52614422235638
                ],
                [
                  7.672031661495566,
                  47.52614422235638
                ],
                [
                  7.672031661495566,
                  47.602062094956636
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität"
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG",
        "temporal_coverage_start": "1973-12-31T23:00:00+00:00",
        "temporal_coverage_end": "2024-06-30T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100040",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geometrie"
      },
      {
        "name": "blo_id",
        "type": "text",
        "label": "ID Statistische Raumeinheit"
      },
      {
        "name": "blo_label",
        "type": "text",
        "label": "Beschriftung"
      },
      {
        "name": "wov_id",
        "type": "text",
        "label": "ID Statistische Raumeinheit"
      },
      {
        "name": "bez_id",
        "type": "text",
        "label": "ID Statistische Raumeinheit"
      },
      {
        "name": "gemeinde",
        "type": "text",
        "label": "Name"
      }
    ],
    "metas": {
      "default": {
        "title": "Statistische Raumeinheiten: Blöcke",
        "title_en": "Statistische Raumeinheiten: Blöcke",
        "description": "<p>Ein Block wird in der Regel von allen Seiten durch Strassen begrenzt. In einzelnen Fällen wird die Abgrenzung durch andere Merkmale vorgegeben (Bahnareale, Wald, Grünzone, Landwirtschaftszone etc.). Statistische Blöcke werden über eine dreistellige Block-Nr. referenziert.<br>Code: Besteht aus Wohnviertel-, Bezirks- und Blocknummerierung, z. B. Block 17.2.005</p>",
        "theme": [
          "Geographie",
          "Statistische Grundlagen"
        ],
        "theme_en": [
          "Geography",
          "Statistical basis"
        ],
        "keyword": [
          "Wohnbezirk",
          "Wohnblock",
          "Wohnblockseite",
          "Wohnviertel",
          "Statistik",
          "Einteilung"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-05-06T00:00:00+00:00",
        "records_count": 1490,
        "geometry_types": [
          "GeometryCollection",
          "MultiPolygon",
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.693801978603005,
                  47.60091796517372
                ],
                [
                  7.55473799072206,
                  47.60091796517372
                ],
                [
                  7.55473799072206,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.60091796517372
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Statistisches Amt",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/ANNUAL"
      }
    }
  },
  {
    "dataset_id": "100042",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geometrie"
      },
      {
        "name": "wov_id",
        "type": "text",
        "label": "ID Statistische Raumeinheit"
      },
      {
        "name": "wov_label",
        "type": "text",
        "label": "Beschriftung"
      },
      {
        "name": "wov_name",
        "type": "text",
        "label": "Name Wohnviertel"
      },
      {
        "name": "gemeinde_name",
        "type": "text",
        "label": "Name"
      }
    ],
    "metas": {
      "default": {
        "title": "Statistische Raumeinheiten: Wohnviertel",
        "title_en": "Statistische Raumeinheiten: Wohnviertel",
        "description": "<p>Zum Kanton Basel-Stadt zählen die Stadt Basel und die Gemeinden Riehen und Bettingen. Die Stadt Basel ist in 19 statistische Wohnviertel gegliedert. Diese statistische Raumeinteilungen existiert seit über 100 Jahren unverändert und erlaubt somit kleinräumige Längsschnittanalysen des Kantons Basel-Stadt.</p>\n<p>Statistische Nummerierung:<br>Im Gegensatz zum amtlichen Gemeindeverzeichnis der Schw",
        "theme": [
          "Geographie"
        ],
        "theme_en": [
          "Geography"
        ],
        "keyword": [
          "Wohnbezirk",
          "Wohnblock",
          "Wohnblockseite",
          "Wohnviertel",
          "Statistik",
          "Einteilung",
          "Quartier"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-05-06T00:00:00+00:00",
        "records_count": 21,
        "geometry_types": [
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.693801978603005,
                  47.60091796517372
                ],
                [
                  7.554659955203533,
                  47.60091796517372
                ],
                [
                  7.554659955203533,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.60091796517372
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Statistisches Amt",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/ANNUAL"
      }
    }
  },
  {
    "dataset_id": "100048",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "datum_zeit",
        "type": "datetime",
        "label": "Datum/Zeit",
        "annotations": {
          "facet": true,
          "timeserie_precision": "hour",
          "id": true
        }
      },
      {
        "name": "timestamp_text",
        "type": "datetime",
        "label": "timestamp_text"
      },
      {
        "name": "o3_stundenmittelwerte_ug_m3",
        "type": "double",
        "label": "o3_stundenmittelwerte_ug_m3",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "geo_point_2d"
      }
    ],
    "metas": {
      "default": {
        "title": "Luftqualität Station Chrischona",
        "title_en": "Luftqualität Station Chrischona",
        "description": "<p>Standortbeschreibung: Die Messstation befindet sich auf halber Höhe des Chrischonaturms. Dieser liegt auf einer Anhöhe östlich der Stadt Basel. In der Nähe der Station Chrischona befinden sich keine Abgasquellen. Sie gibt die Luftsituation wieder im ländlichen Umland der Stadt Basel, auf einer Höhenlage von 640m über Meer. In diesem Höhenbereich liegt oft auch die Inversion in der Nordwestschwe",
        "theme": [
          "Raum und Umwelt",
          "Gesundheit",
          "Tourismus"
        ],
        "theme_en": [
          "Territory and environment",
          "Health",
          "Tourism"
        ],
        "keyword": [
          "Luft",
          "Ozon"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T18:16:00.988000+00:00",
        "records_count": 231329,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.686583296477795,
                  47.572199991822245
                ],
                [
                  7.687583296477794,
                  47.572199991822245
                ],
                [
                  7.687583296477794,
                  47.57119999182224
                ],
                [
                  7.686583296477795,
                  47.57119999182224
                ],
                [
                  7.686583296477795,
                  47.572199991822245
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Umwelt und Energie",
        "territory": [
          "Bettingen"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/HOURLY",
        "temporal_coverage_start": "1999-12-31T23:00:00+00:00",
        "temporal_coverage_end": "2026-09-01T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100049",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "datum_zeit",
        "type": "datetime",
        "label": "Datum/Zeit",
        "annotations": {
          "facet": true,
          "timeserie_precision": "hour",
          "id": true
        }
      },
      {
        "name": "timestamp_text",
        "type": "text",
        "label": "timestamp_text"
      },
      {
        "name": "pm10_stundenmittelwerte_ug_m3",
        "type": "double",
        "label": "PM10 (Stundenmittelwerte)",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "pm2_5_stundenmittelwerte_ug_m3",
        "type": "double",
        "label": "PM2.5 (Stundenmittelwerte)",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "o3_stundenmittelwerte_ug_m3",
        "type": "double",
        "label": "O3 (Stundenmittelwerte)",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "no2_stundenmittelwerte_ug_m3",
        "type": "double",
        "label": "NO2 (Stundenmittelwerte)",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "geo_point_2d"
      }
    ],
    "metas": {
      "default": {
        "title": "Luftqualität Station St. Johannplatz",
        "title_en": "Luftqualität Station St. Johannplatz",
        "description": "<p>Standortbeschreibung: Die Messstation befindet sich in Basel auf dem St.Johannplatz, einem kleinen Park am Rande der Altstadt. Sie wird lokal beeinflusst durch eine mässig befahrene Strasse und Parkplatzsuchverkehr. 500m nördlich verläuft eine stark befahrene Strasse und in dieser Richtung liegt auch ein Teil der Chemischen Industrie. Die Station Basel St.Johannplatz gibt die Belastung wieder, ",
        "theme": [
          "Raum und Umwelt",
          "Gesundheit",
          "Tourismus"
        ],
        "theme_en": [
          "Territory and environment",
          "Health",
          "Tourism"
        ],
        "keyword": [
          "Luft",
          "Feinstaub",
          "Ozon",
          "Echtzeit",
          "Realtime",
          "Stickstoffdioxid",
          "Stickoxid",
          "O3",
          "NO2",
          "NOX"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T18:16:07.096000+00:00",
        "records_count": 233041,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.581419999793172,
                  47.566435379825535
                ],
                [
                  7.582419999793172,
                  47.566435379825535
                ],
                [
                  7.582419999793172,
                  47.56543537982553
                ],
                [
                  7.581419999793172,
                  47.56543537982553
                ],
                [
                  7.581419999793172,
                  47.566435379825535
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Umwelt und Energie",
        "territory": [
          "Basel"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/HOURLY",
        "temporal_coverage_start": "1999-12-31T23:00:00+00:00",
        "temporal_coverage_end": "2026-08-31T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100050",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "datum_zeit",
        "type": "datetime",
        "label": "Datum/Zeit",
        "annotations": {
          "facet": true,
          "id": true
        }
      },
      {
        "name": "timestamp_text",
        "type": "text",
        "label": "timestamp_text"
      },
      {
        "name": "pm10_stundenmittelwerte_ug_m3",
        "type": "double",
        "label": "pm10_stundenmittelwerte_ug_m3",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "pm2_5_stundenmittelwerte_ug_m3",
        "type": "double",
        "label": "pm2_5_stundenmittelwerte_ug_m3",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "no2_stundenmittelwerte_ug_m3",
        "type": "double",
        "label": "no2_stundenmittelwerte_ug_m3",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "o3_stundenmittelwerte_ug_m3",
        "type": "double",
        "label": "o3_stundenmittelwerte_ug_m3",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "geo_point_2d"
      }
    ],
    "metas": {
      "default": {
        "title": "Luftqualität Station Feldbergstrasse",
        "title_en": "Luftqualität Station Feldbergstrasse",
        "description": "<p>Standortbeschreibung: Die Messstation befindet sich in Basel direkt an der Kreuzung Feldbergstrasse / Hammerstrasse. Sie liegt in einer schlecht durchlüfteten Strassenschlucht mit hohem Verkehrsaufkommen und oft stehendem Kolonnenverkehr. Die Station Basel Feldbergstrasse ist ein Ort mit sehr hoher lokaler Belastung innerhalb der Stadt Basel.</p><p>Lage: Stadtzentrum an Strasse, geschlossene Be",
        "theme": [
          "Raum und Umwelt",
          "Gesundheit",
          "Tourismus"
        ],
        "theme_en": [
          "Territory and environment",
          "Health",
          "Tourism"
        ],
        "keyword": [
          "Luft",
          "Feinstaub",
          "Stickstoffdioxid",
          "Stickoxid",
          "NO2",
          "NOX",
          "Motorräder",
          "Echtzeit",
          "Realtime"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T18:16:13.429000+00:00",
        "records_count": 231872,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.5920445649772885,
                  47.56751668724418
                ],
                [
                  7.593044564977288,
                  47.56751668724418
                ],
                [
                  7.593044564977288,
                  47.566516687244174
                ],
                [
                  7.5920445649772885,
                  47.566516687244174
                ],
                [
                  7.5920445649772885,
                  47.56751668724418
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Umwelt und Energie",
        "territory": [
          "Basel"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/HOURLY",
        "temporal_coverage_start": "1999-12-31T23:00:00+00:00",
        "temporal_coverage_end": "2026-08-31T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100051",
    "has_records": true,
    "features": [
      "timeserie",
      "analyze"
    ],
    "fields": [
      {
        "name": "datum_zeit",
        "type": "datetime",
        "label": "Datum/Zeit",
        "annotations": {
          "timeserie_precision": "hour",
          "facet": true
        }
      },
      {
        "name": "timestamp_text",
        "type": "text",
        "label": "timestamp_text"
      },
      {
        "name": "o3_ug_m3",
        "type": "double",
        "label": "O3 [ug/m3]",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "no2_ug_m3",
        "type": "double",
        "label": "NO2 [ug/m3]",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "pm10_ug_m3",
        "type": "double",
        "label": "PM10 [ug/m3]",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "pm2_5_ug_m3",
        "type": "double",
        "label": "PM2.5 [ug/m3]",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "cpc_1_cm3",
        "type": "double",
        "label": "CPC [1/cm3]"
      },
      {
        "name": "ec_ug_m3",
        "type": "double",
        "label": "EC [ug/m3]",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "prec_mm",
        "type": "double",
        "label": "PREC [mm]",
        "annotations": {
          "unit": "mm"
        }
      },
      {
        "name": "rad_w_m2",
        "type": "double",
        "label": "RAD [W/m2]"
      },
      {
        "name": "so2_ug_m3",
        "type": "double",
        "label": "SO2 [ug/m3]",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "nox_ug_m3_eq_no2",
        "type": "double",
        "label": "NOX [ug/m3 eq. NO2]",
        "annotations": {
          "unit": "μg/m3"
        }
      },
      {
        "name": "temp_c",
        "type": "double",
        "label": "TEMP [C]",
        "annotations": {
          "unit": "°C"
        }
      }
    ],
    "metas": {
      "default": {
        "title": "Luftqualität Station Basel-Binningen",
        "title_en": "Luftqualität Station Basel-Binningen",
        "description": "<p>Stündliche Messungen der <a href=\"https://www.meteoschweiz.admin.ch/home/messwerte.html?param=messnetz-automatisch&amp;station=BAS\" target=\"_blank\">automatischen Wetterstation Basel-Binningen</a>. </p>",
        "theme": [
          "Raum und Umwelt",
          "Gesundheit",
          "Tourismus"
        ],
        "theme_en": [
          "Territory and environment",
          "Health",
          "Tourism"
        ],
        "keyword": [
          "Luft",
          "Ozon",
          "Stickstoffdioxid",
          "Stickoxid",
          "NO2",
          "NOX",
          "Feinstaub",
          "Kohlenmonoxid",
          "CO",
          "Partikelzahlkonzentraion",
          "Russ",
          "Temperatur",
          "Niederschlag",
          "Globalstrahlung"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T20:20:45.173000+00:00",
        "records_count": 72384,
        "publisher": "MeteoSchweiz",
        "territory": [
          "Basel",
          "Binningen"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/HOURLY",
        "temporal_coverage_start": "2018-05-31T22:00:00+00:00",
        "temporal_coverage_end": "2026-09-01T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100052",
    "has_records": true,
    "features": [
      "geo",
      "analyze",
      "timeserie"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "gml_id",
        "type": "text",
        "label": "GML-ID",
        "annotations": {
          "id": true
        }
      },
      {
        "name": "ba_baumnr",
        "type": "text",
        "label": "Baumnummer",
        "annotations": {
          "id": true
        }
      },
      {
        "name": "ba_art",
        "type": "text",
        "label": "Baumart"
      },
      {
        "name": "baumart_lateinisch",
        "type": "text",
        "label": "Baumart lateinisch"
      },
      {
        "name": "baumart_deutsch",
        "type": "text",
        "label": "Baumart deutsch"
      },
      {
        "name": "timeposition",
        "type": "date",
        "label": "Pflanzdatum"
      },
      {
        "name": "ba_baumalter",
        "type": "int",
        "label": "Baumalter",
        "annotations": {
          "unit": "years"
        }
      },
      {
        "name": "ba_standjahr",
        "type": "int",
        "label": "Standjahr",
        "annotations": {
          "unit": "years"
        }
      },
      {
        "name": "ba_schutzstatus",
        "type": "text",
        "label": "Schutzstatus"
      },
      {
        "name": "ba_strasse",
        "type": "text",
        "label": "Strasse"
      },
      {
        "name": "ba_kreis",
        "type": "text",
        "label": "Kreis"
      },
      {
        "name": "ba_gruppe",
        "type": "text",
        "label": "Gruppe"
      },
      {
        "name": "ba_gemeinde",
        "type": "text",
        "label": "Gemeinde"
      },
      {
        "name": "map_links",
        "type": "text",
        "label": "Map Links"
      }
    ],
    "metas": {
      "default": {
        "title": "Baumkataster: Baumbestand",
        "title_en": "Baumkataster: Baumbestand",
        "description": "Der Baumkataster umfasst den durch die Stadtgärtnerei Basel (Gebiet Stadt Basel) und die Gemeinde Riehen (Gebiet Riehen) gepflegten Baumbestand.",
        "theme": [
          "Raum und Umwelt",
          "Geographie"
        ],
        "theme_en": [
          "Territory and environment",
          "Geography"
        ],
        "keyword": [
          "Baum",
          "Baumbestand",
          "Stadtbaum",
          "Baumschutz",
          "Unterhalt",
          "Pflege",
          "Kataster"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2026-09-02T00:00:00+00:00",
        "records_count": 32416,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.671319954097271,
                  47.59513202123344
                ],
                [
                  7.549376841634512,
                  47.59513202123344
                ],
                [
                  7.549376841634512,
                  47.52116336021572
                ],
                [
                  7.671319954097271,
                  47.52116336021572
                ],
                [
                  7.671319954097271,
                  47.59513202123344
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Stadtgärtnerei",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/DAILY"
      }
    }
  },
  {
    "dataset_id": "100054",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "gml_id",
        "type": "text",
        "label": "OBJID"
      },
      {
        "name": "ba_art",
        "type": "text",
        "label": "Baumart"
      },
      {
        "name": "baumart_lateinisch",
        "type": "text",
        "label": "baumart_lateinisch"
      },
      {
        "name": "baumart_deutsch",
        "type": "text",
        "label": "baumart_deutsch"
      },
      {
        "name": "mapbs_ba_baumnr",
        "type": "text",
        "label": "Baumnummer"
      },
      {
        "name": "ba_schutzstatus",
        "type": "text",
        "label": "Schutzstatus"
      },
      {
        "name": "ba_stammumfang",
        "type": "int",
        "label": "Stammumfang",
        "annotations": {
          "unit": "cm"
        }
      },
      {
        "name": "ba_strasse",
        "type": "text",
        "label": "Strasse"
      },
      {
        "name": "ba_faellgrund",
        "type": "text",
        "label": "Fällgrund"
      },
      {
        "name": "ba_faellgrund_bemerkung",
        "type": "text",
        "label": "Fällgrund - weitere Informationen"
      },
      {
        "name": "map_links",
        "type": "text",
        "label": "Map Links"
      }
    ],
    "metas": {
      "default": {
        "title": "Baumkataster: Fäll- und Baumersatzliste",
        "title_en": "Baumkataster: Fäll- und Baumersatzliste",
        "description": "Der Baumkataster umfasst den durch die Stadtgärtnerei Basel (Gebiet Stadt Basel) und die Gemeinde Riehen (Gebiet Riehen) gepflegten Baumbestand. Bäume sind im Kanton Basel-Stadt gemäss Baumschutzgesetz (BSchG) geschützt. Die Fäll- und Baumersatzliste enthält diejenigen geschützten Bäume, welche innerhalb der nächsten 6 Monate gefällt, ersetzt und neu gepflanzt werden müssen. Fällungen werden jewei",
        "theme": [
          "Raum und Umwelt",
          "Geographie"
        ],
        "theme_en": [
          "Territory and environment",
          "Geography"
        ],
        "keyword": [
          "Baum",
          "Stadtbaum",
          "Unterhalt",
          "Pflege",
          "Ersatz",
          "Fällung",
          "Kataster"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2026-04-28T00:00:00+00:00",
        "records_count": 1,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.604694197967649,
                  47.5736513183564
                ],
                [
                  7.605694197967648,
                  47.5736513183564
                ],
                [
                  7.605694197967648,
                  47.57265131835639
                ],
                [
                  7.604694197967649,
                  47.57265131835639
                ],
                [
                  7.604694197967649,
                  47.5736513183564
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Stadtgärtnerei",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/DAILY"
      }
    }
  },
  {
    "dataset_id": "100056",
    "has_records": false,
    "features": [],
    "fields": [],
    "metas": {
      "default": {
        "title": "Schulwegsicherheit: Fusswege",
        "title_en": "Schulwegsicherheit: Fusswege",
        "description": "Die Daten zur Schulwegsicherheit zeigen auf, wo Strassenübergänge für Kinder im Kindergarten- und Schulalter übersichtlich und einfach sind, bzw. wo erhöhte Anforderungen an das Überqueren der Strasse gestellt werden. Der Datensatz enthält die Achsen der Fusswege, das heisst Trottoirs und wo nötig Strassen. Es werden alle für Fussgänger begehbaren Wege, Strassen oder Parkwege innerhalb und an der ",
        "theme": [
          "Öffentliche Ordnung und Sicherheit",
          "Mobilität und Verkehr"
        ],
        "theme_en": [
          "Public order and security",
          "Mobility and Transport"
        ],
        "keyword": [
          "Schulweg",
          "Sicherheit",
          "Kindergarten",
          "Primarschule",
          "Sekundarschule",
          "Schüler",
          "Schülerin",
          "Unfall",
          "Prävention",
          "Fussweg",
          "Strasse",
          "Trottoir",
          "Gehsteig",
          "Querung",
          "überqueren",
          "Fussgängerstreifen"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2025-08-28T14:18:25.520000+00:00",
        "records_count": 0,
        "publisher": "Kantonspolizei",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/QUARTERLY"
      }
    }
  },
  {
    "dataset_id": "100082",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "name_original",
        "type": "text",
        "label": "Station-ID",
        "annotations": {
          "facet": true,
          "id": true
        }
      },
      {
        "name": "name_custom",
        "type": "text",
        "label": "Name",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "dates_min_date",
        "type": "datetime",
        "label": "Werte seit",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "dates_max_date",
        "type": "datetime",
        "label": "Werte bis",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "coords",
        "type": "geo_point_2d",
        "label": "Koordinaten"
      },
      {
        "name": "lon",
        "type": "double",
        "label": "Längengrad"
      },
      {
        "name": "lat",
        "type": "double",
        "label": "Breitengrad"
      },
      {
        "name": "stadtklima_basel_link",
        "type": "text",
        "label": "Stadtklima Basel Link"
      }
    ],
    "metas": {
      "default": {
        "title": "Standorte Messstationen Smart Climate Luftklima",
        "title_en": "Standorte Messstationen Smart Climate Luftklima",
        "description": "<p>Der Datensatz zeigt die Standorte der Messstationen für den Datensatz <a href=\"https://data.bs.ch/explore/dataset/100009/\" target=\"_blank\">«Luftklima Smart Regio Basel» (https://data.bs.ch/explore/dataset/100009/)</a>.</p><p><b>Änderungsprotokoll:</b></p><p><b>18.04.2024:</b> Die Koordinaten werden automatisch plausibilisiert. Es werde nur Koordinaten angezeigt, die in einem bestimmten Umkreis ",
        "theme": [
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Territory and environment"
        ],
        "keyword": [
          "Wetter",
          "Temperatur",
          "Regen",
          "Niederschlag",
          "Sensoren",
          "Klima",
          "Wolf-Areal",
          "Smart City Lab"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T20:10:28.133000+00:00",
        "records_count": 198,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.714859917759895,
                  47.63169698417187
                ],
                [
                  7.523119943216443,
                  47.63169698417187
                ],
                [
                  7.523119943216443,
                  47.46800998225808
                ],
                [
                  7.714859917759895,
                  47.46800998225808
                ],
                [
                  7.714859917759895,
                  47.63169698417187
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "meteoblue AG",
        "territory": [
          "World"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG",
        "temporal_coverage_start": "1999-12-30T23:00:00+00:00",
        "temporal_coverage_end": "2026-09-01T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100087",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "station_id",
        "type": "text",
        "label": "Station",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "timestamp",
        "type": "datetime",
        "label": "Zeitstempel",
        "annotations": {
          "facet": true,
          "timeserie_precision": "minute"
        }
      },
      {
        "name": "value",
        "type": "double",
        "label": "Wert",
        "annotations": {
          "unit": "db"
        }
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geopunkt"
      },
      {
        "name": "latitude",
        "type": "double",
        "label": "Geographische Breite"
      },
      {
        "name": "longitude",
        "type": "double",
        "label": "Geographische Länge"
      },
      {
        "name": "eui",
        "type": "text",
        "label": "EUI",
        "annotations": {
          "facet": true
        }
      }
    ],
    "metas": {
      "default": {
        "title": "Smart Climate Schallpegelmessungen",
        "title_en": "Smart Climate Schallpegelmessungen",
        "description": "<p>Im Rahmen des Projektes «Smart Climate» von\nSmart Regio Basel (<a href=\"https://smartregiobasel.ch/de/projekte/smart-climate-plug-and-sense\" target=\"_blank\">https://smartregiobasel.ch/de/projekte/smart-climate-plug-and-sense</a>)\nwerden an verschiedenen Standorten in der Region Basel Schallpegeldaten mit\nLoRa-Sensoren gemessen. Das Lufthygieneamt beider Basel, das Amt für Umwelt und\nEnergie des",
        "theme": [
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Territory and environment"
        ],
        "keyword": [
          "Schall",
          "Lärm",
          "Pegel",
          "Lautstärke",
          "Belästigung"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T20:00:17.892000+00:00",
        "records_count": 1871629,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.613699985668063,
                  47.58254998829216
                ],
                [
                  7.59010199457407,
                  47.58254998829216
                ],
                [
                  7.59010199457407,
                  47.54347996786237
                ],
                [
                  7.613699985668063,
                  47.54347996786237
                ],
                [
                  7.613699985668063,
                  47.58254998829216
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Umwelt und Energie",
        "territory": [
          "Basel"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/CONT",
        "temporal_coverage_start": "2020-06-23T22:00:00+00:00",
        "temporal_coverage_end": "2026-09-01T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100097",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "timestamp",
        "type": "datetime",
        "label": "Timestamp",
        "annotations": {
          "facet": true,
          "timeserie_precision": "minute"
        }
      },
      {
        "name": "messung_id",
        "type": "text",
        "label": "Messung-ID",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "richtung_id",
        "type": "text",
        "label": "Richtung ID",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "geschwindigkeit",
        "type": "double",
        "label": "Geschwindigkeit",
        "annotations": {
          "unit": "km/h",
          "facet": true
        }
      },
      {
        "name": "zeit",
        "type": "text",
        "label": "Zeit"
      },
      {
        "name": "datum",
        "type": "text",
        "label": "Datum"
      },
      {
        "name": "datum_zeit",
        "type": "text",
        "label": "Datum und Zeit"
      },
      {
        "name": "messbeginn",
        "type": "date",
        "label": "Messbeginn"
      },
      {
        "name": "messende",
        "type": "date",
        "label": "Messende"
      },
      {
        "name": "zone",
        "type": "double",
        "label": "Zone",
        "annotations": {
          "facet": true,
          "unit": "km/h"
        }
      },
      {
        "name": "ort",
        "type": "text",
        "label": "Ort",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "richtung",
        "type": "text",
        "label": "Richtung"
      },
      {
        "name": "the_geom",
        "type": "geo_shape",
        "label": "Koordinaten"
      },
      {
        "name": "ue_quote",
        "type": "double",
        "label": "Übertretungsquote",
        "annotations": {
          "unit": "%",
          "facet": true
        }
      },
      {
        "name": "v50",
        "type": "double",
        "label": "Geschwindigkeit V50",
        "annotations": {
          "facet": true,
          "unit": "km/h"
        }
      },
      {
        "name": "v85",
        "type": "double",
        "label": "Geschwindigkeit V85",
        "annotations": {
          "facet": true,
          "unit": "km/h"
        }
      },
      {
        "name": "strasse",
        "type": "text",
        "label": "Strasse",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "strasse_nr",
        "type": "text",
        "label": "Hausnummer"
      },
      {
        "name": "fzg",
        "type": "int",
        "label": "Fahrzeuge",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "fahrzeuglange",
        "type": "double",
        "label": "Fahrzeuglänge",
        "annotations": {
          "unit": "m"
        }
      },
      {
        "name": "link_zu_messung",
        "type": "text",
        "label": "Kennzahlen pro Mess-Standort"
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "geo_point_2d"
      }
    ],
    "metas": {
      "default": {
        "title": "Geschwindigkeitsmonitoring: Einzelmessungen",
        "title_en": "Geschwindigkeitsmonitoring: Einzelmessungen",
        "description": "<p></p><p></p><p class=\"MsoNormal\" style=\"margin-bottom: 12pt; line-height: normal; background-image: initial; background-position: initial; background-size: initial; background-repeat: initial; background-attachment: initial; background-origin: initial; background-clip: initial;\">Einzelmessungen des\nGeschwindigkeitsmonitorings der Kantonspolizei Basel-Stadt</p><p class=\"MsoNormal\" style=\"margin-b",
        "theme": [
          "Mobilität und Verkehr"
        ],
        "theme_en": [
          "Mobility and Transport"
        ],
        "keyword": [
          "Geschwindigkeit",
          "Verkehr",
          "Auto",
          "PW",
          "PKW",
          "LW",
          "LKW",
          "Messwert",
          "Einzelmessung",
          "Messung"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-08-25T02:43:14.031000+00:00",
        "records_count": 16804745,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.6702772453427315,
                  47.59259150829166
                ],
                [
                  7.5588165409862995,
                  47.59259150829166
                ],
                [
                  7.5588165409862995,
                  47.53471903502941
                ],
                [
                  7.6702772453427315,
                  47.53471903502941
                ],
                [
                  7.6702772453427315,
                  47.59259150829166
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Kantonspolizei",
        "territory": [
          "Germany",
          "Switzerland"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/MONTHLY",
        "temporal_coverage_start": "2024-01-14T23:00:00+00:00",
        "temporal_coverage_end": "2026-08-23T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100120",
    "has_records": true,
    "features": [
      "geo",
      "analyze",
      "timeserie"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "gml_id",
        "type": "text",
        "label": "Eindeutiger Identifikator des Unfalls"
      },
      {
        "name": "vu_typ",
        "type": "text",
        "label": "Beschreibung zum Unfalltyp"
      },
      {
        "name": "vu_schwerekategorie",
        "type": "text",
        "label": "Beschreibung der Unfallschwerekategorie"
      },
      {
        "name": "vu_jahr",
        "type": "date",
        "label": "Unfalljahr",
        "annotations": {
          "timeserie_precision": "year"
        }
      },
      {
        "name": "vu_monat",
        "type": "int",
        "label": "Unfallmonat"
      },
      {
        "name": "vu_stunde",
        "type": "int",
        "label": "Unfallstunde"
      },
      {
        "name": "vu_wochentag",
        "type": "text",
        "label": "Wochentag"
      },
      {
        "name": "vu_strassenart",
        "type": "text",
        "label": "Strassenart"
      },
      {
        "name": "vu_fussgaengerbeteiligung",
        "type": "boolean",
        "label": "Fussgängerbeteiligung"
      },
      {
        "name": "vu_fahrradbeteiligung",
        "type": "boolean",
        "label": "Fahrradbeteiligung"
      },
      {
        "name": "vu_motorradbeteiligung",
        "type": "boolean",
        "label": "Motorradbeteiligung"
      }
    ],
    "metas": {
      "default": {
        "title": "Strassenverkehrsunfälle",
        "title_en": "Strassenverkehrsunfälle",
        "description": "Die Strassenverkehrsunfälle im Kanton Basel-Stadt seit 2011 werden nach Unfalltyp und Unfallschweregrad kategorisiert dargestellt. Die Daten werden jährlich aktualisiert.",
        "theme": [
          "Mobilität und Verkehr",
          "Öffentliche Ordnung und Sicherheit",
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Public order and security",
          "Territory and environment"
        ],
        "keyword": [
          "Verkehrsunfall",
          "Fussgänger",
          "Schaden",
          "Gefährdung",
          "Velo",
          "Auto",
          "Motorräder",
          "Unfall",
          "Verkehrsunfälle"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2025-05-08T00:00:00+00:00",
        "records_count": 11883,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.692592050880194,
                  47.60020726360381
                ],
                [
                  7.55619116127491,
                  47.60020726360381
                ],
                [
                  7.55619116127491,
                  47.52372587565333
                ],
                [
                  7.692592050880194,
                  47.52372587565333
                ],
                [
                  7.692592050880194,
                  47.60020726360381
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Kantonspolizei",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/ANNUAL",
        "temporal_coverage_start": "2010-12-31T23:00:00+00:00",
        "temporal_coverage_end": "2025-12-30T23:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100125",
    "has_records": true,
    "features": [
      "geo",
      "analyze",
      "timeserie"
    ],
    "fields": [
      {
        "name": "datum",
        "type": "date",
        "label": "Datum",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "wohnviertel",
        "type": "text",
        "label": "Wohnviertel",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "wov_id",
        "type": "text",
        "label": "Wohnviertel-ID",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "wohnbezirk",
        "type": "text",
        "label": "Bezirk",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "bez_id",
        "type": "text",
        "label": "Bezirks-ID",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "gemeinde",
        "type": "text",
        "label": "Gemeinde",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "anzahl",
        "type": "int",
        "label": "Anzahl"
      },
      {
        "name": "jahr",
        "type": "text",
        "label": "Jahr"
      },
      {
        "name": "monat",
        "type": "int",
        "label": "Monat"
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geometrie"
      }
    ],
    "metas": {
      "default": {
        "title": "Wohnbevölkerung nach Bezirk",
        "title_en": "Wohnbevölkerung nach Bezirk",
        "description": "Dieser Datensatz zeigt die Wohnbevölkerung des Kantons Basel-Stadt auf Ebene Bezirk. Die Daten werden monatlich aktualisiert. Bis zum Jahr 2011 sind nur die Jahresendbestände verfügbar.<br>Die hier veröffentlichten Werte der Jahre 1979 bis 2011 weichen aus methodischen Gründen von denjenigen in der kantonalen öffentlichen Statistik ab: In Letzterer wurde bis zum Jahr 2011 die Bevölkerungszahl durc",
        "theme": [
          "Bevölkerung"
        ],
        "theme_en": [
          "Population"
        ],
        "keyword": [
          "Bezirk",
          "Bevölkerungsbestand",
          "Entwicklung",
          "Einwohnerzahl",
          "Bevölkerungsstruktur"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T01:17:33.380000+00:00",
        "records_count": 14390,
        "geometry_types": [
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.693801978603005,
                  47.60091796517372
                ],
                [
                  7.554659955203533,
                  47.60091796517372
                ],
                [
                  7.554659955203533,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.60091796517372
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Statistisches Amt",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/MONTHLY"
      }
    }
  },
  {
    "dataset_id": "100151",
    "has_records": true,
    "features": [
      "geo",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geometrie"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "id",
        "type": "int",
        "label": "ID Anlage"
      },
      {
        "name": "kategorie",
        "type": "text",
        "label": "Kategorie"
      },
      {
        "name": "name",
        "type": "text",
        "label": "Name"
      },
      {
        "name": "beschreibung",
        "type": "text",
        "label": "Beschreibung"
      },
      {
        "name": "strasse",
        "type": "text",
        "label": "Strasse"
      },
      {
        "name": "postleitzahl",
        "type": "text",
        "label": "Postleitzahl"
      },
      {
        "name": "ort",
        "type": "text",
        "label": "Ortschaftsname"
      },
      {
        "name": "link",
        "type": "text",
        "label": "Link zur Anlage"
      },
      {
        "name": "zustaendigkeit",
        "type": "text",
        "label": "Zuständigkeit"
      },
      {
        "name": "bemerkung",
        "type": "text",
        "label": "Bemerkung"
      },
      {
        "name": "map_links",
        "type": "text",
        "label": "Zum Objekt navigieren"
      }
    ],
    "metas": {
      "default": {
        "title": "Sport- und Bewegungsanlagen",
        "title_en": "Sport- und Bewegungsanlagen",
        "description": "<p>Der Datensatz bildet alle wichtigen Sport- und Bewegungsanlagen im Perimeter Kanton Basel-Stadt sowie alle kantonalen Sportanlagen ausserhalb der Kantons- und Landesgrenzen ab.</p>",
        "theme": [
          "Kultur, Medien, Informationsgesellschaft, Sport",
          "Geographie",
          "Tourismus"
        ],
        "theme_en": [
          "Culture, media, information society, sport",
          "Geography",
          "Tourism"
        ],
        "keyword": [
          "Anlage",
          "Bäder",
          "Badi",
          "Gartenbad",
          "Hallenbad",
          "Platz",
          "Schwimmbad",
          "Spielwiese",
          "Training",
          "Zentrum",
          "Sport",
          "Sportanlagen",
          "OpenSportData"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-05-05T00:00:00+00:00",
        "records_count": 313,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.6665089931339025,
                  47.59421399328858
                ],
                [
                  7.551776999607682,
                  47.59421399328858
                ],
                [
                  7.551776999607682,
                  47.52822699956596
                ],
                [
                  7.6665089931339025,
                  47.52822699956596
                ],
                [
                  7.6665089931339025,
                  47.59421399328858
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Jugend, Familie und Sport",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/AS_NEEDED"
      }
    }
  },
  {
    "dataset_id": "100170",
    "has_records": true,
    "features": [
      "timeserie",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "timestamp",
        "type": "datetime",
        "label": "Zeitstempel",
        "annotations": {
          "facet": true,
          "id": true
        }
      },
      {
        "name": "general_level",
        "type": "double",
        "label": "Mittelungspegel"
      },
      {
        "name": "level_00025",
        "type": "double",
        "label": "25 Hz"
      },
      {
        "name": "level_00031_5",
        "type": "double",
        "label": "31.5 Hz"
      },
      {
        "name": "level_00040",
        "type": "double",
        "label": "40 Hz"
      },
      {
        "name": "level_00050",
        "type": "double",
        "label": "50 Hz"
      },
      {
        "name": "level_00063",
        "type": "double",
        "label": "63 Hz"
      },
      {
        "name": "level_00080",
        "type": "double",
        "label": "80 Hz"
      },
      {
        "name": "level_00100",
        "type": "double",
        "label": "100 Hz"
      },
      {
        "name": "level_00125",
        "type": "double",
        "label": "125 Hz"
      },
      {
        "name": "level_00160",
        "type": "double",
        "label": "160 Hz"
      },
      {
        "name": "level_00200",
        "type": "double",
        "label": "200 Hz"
      },
      {
        "name": "level_00250",
        "type": "double",
        "label": "250 Hz"
      },
      {
        "name": "level_00315",
        "type": "double",
        "label": "315 Hz"
      },
      {
        "name": "level_00400",
        "type": "double",
        "label": "400 Hz"
      },
      {
        "name": "level_00500",
        "type": "double",
        "label": "500 Hz"
      },
      {
        "name": "level_00630",
        "type": "double",
        "label": "630 Hz"
      },
      {
        "name": "level_00800",
        "type": "double",
        "label": "800 Hz"
      },
      {
        "name": "level_01000",
        "type": "double",
        "label": "1000 Hz"
      },
      {
        "name": "level_01250",
        "type": "double",
        "label": "1250 Hz"
      },
      {
        "name": "level_01600",
        "type": "double",
        "label": "1600 Hz"
      },
      {
        "name": "level_02000",
        "type": "double",
        "label": "2000 Hz"
      },
      {
        "name": "level_02500",
        "type": "double",
        "label": "2500 Hz"
      },
      {
        "name": "level_03150",
        "type": "double",
        "label": "3150 Hz"
      },
      {
        "name": "level_04000",
        "type": "double",
        "label": "4000 Hz"
      },
      {
        "name": "level_05000",
        "type": "double",
        "label": "5000 Hz"
      },
      {
        "name": "level_06300",
        "type": "double",
        "label": "6300 Hz"
      },
      {
        "name": "level_08000",
        "type": "double",
        "label": "8000 Hz"
      },
      {
        "name": "level_10000",
        "type": "double",
        "label": "10000 Hz"
      },
      {
        "name": "level_12500",
        "type": "double",
        "label": "12500 Hz"
      },
      {
        "name": "level_16000",
        "type": "double",
        "label": "16000 Hz"
      },
      {
        "name": "timestamp_text",
        "type": "text",
        "label": "timestamp_text"
      }
    ],
    "metas": {
      "default": {
        "title": "Smarte Strasse: Verkehrslärm",
        "title_en": "Smarte Strasse: Verkehrslärm",
        "description": "<p>Das Amt für Umwelt und Energie (AUE) testet im Rahmen des Projekts «Smarte Strasse» einen akustischen Sensor bezüglich Funktionalität, Genauigkeit und Zuverlässigkeit. Der Lärmsensor erfasst Umgebungsgeräusche und erkennt mittels künstlicher Intelligenz die individuellen Lärmprofile verschiedener Fahrzeuge. Dadurch kann der Sensor dazu verwendet werden, in Echtzeit richtungsgetrennte Verkehrszä",
        "theme": [
          "Mobilität und Verkehr",
          "Tourismus"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Tourism"
        ],
        "keyword": [
          "Lärm",
          "Smarte Strasse"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2024-02-29T13:52:55.404000+00:00",
        "records_count": 144229,
        "publisher": "Amt für Umwelt und Energie",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/NEVER",
        "temporal_coverage_start": "2022-01-30T23:00:00+00:00",
        "temporal_coverage_end": "2023-06-26T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100176",
    "has_records": true,
    "features": [
      "analyze",
      "geo",
      "custom_view"
    ],
    "fields": [
      {
        "name": "id",
        "type": "double",
        "label": "ID",
        "annotations": {
          "facet": true,
          "id": true
        }
      },
      {
        "name": "lat",
        "type": "double",
        "label": "Breitengrad"
      },
      {
        "name": "lon",
        "type": "double",
        "label": "Längengrad"
      },
      {
        "name": "coord",
        "type": "geo_point_2d",
        "label": "Koordinaten"
      },
      {
        "name": "adresse",
        "type": "text",
        "label": "Adresse",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "typ",
        "type": "text",
        "label": "Typ",
        "annotations": {
          "facet": true
        }
      }
    ],
    "metas": {
      "default": {
        "title": "Smarte Strasse: Parkplatz-Zonen",
        "title_en": "Smarte Strasse: Parkplatz-Zonen",
        "description": "<p style=\"font-family: sans-serif;\">Der Datensatz zeigt die Standorte der Parkplätze, die im Rahmen des Projekts «Smarte Strasse» für die Testung der Sensoren einbezogen werden.<br>Zusätzlich relevante Datensätze für die Parkplatzbelegung:</p><ul><li style=\"\"><a href=\"https://data.bs.ch/explore/dataset/100171/\" target=\"_blank\">Zu- und Wegfahrten, Parkplatzauslastung</a></li><li style=\"\"><a href=\"h",
        "theme": [
          "Mobilität und Verkehr"
        ],
        "theme_en": [
          "Mobility and Transport"
        ],
        "keyword": [
          "Smarte Strasse",
          "Parkplatz"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-02-07T10:35:40.052000+00:00",
        "records_count": 6,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.584761967882514,
                  47.54304297734052
                ],
                [
                  7.584478994831443,
                  47.54304297734052
                ],
                [
                  7.584478994831443,
                  47.54285995848477
                ],
                [
                  7.584761967882514,
                  47.54285995848477
                ],
                [
                  7.584761967882514,
                  47.54304297734052
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität",
        "territory": [
          "Basel"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/NEVER",
        "temporal_coverage_start": "2022-04-25T22:00:00+00:00",
        "temporal_coverage_end": "2022-10-03T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100189",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geometrie"
      },
      {
        "name": "id_strasse",
        "type": "int",
        "label": "Amtliche Strassennummer"
      },
      {
        "name": "strassenname",
        "type": "text",
        "label": "Strassenbezeichnung"
      },
      {
        "name": "strassenname_kurz",
        "type": "text",
        "label": "Strassenbezeichnung kurz"
      },
      {
        "name": "strassenindex",
        "type": "text",
        "label": "Strassenindex"
      },
      {
        "name": "gemeindename",
        "type": "text",
        "label": "Name"
      },
      {
        "name": "erklaerung_erste_zeile",
        "type": "text",
        "label": "Erklärung erste Zeile"
      },
      {
        "name": "erklaerung_zweite_zeile",
        "type": "text",
        "label": "Erklärung zweite Zeile"
      },
      {
        "name": "amtliche_benennung",
        "type": "text",
        "label": "Amtliche Benennung"
      },
      {
        "name": "erstmalige_erwaehnung",
        "type": "text",
        "label": "Erstmalige Erwähnung"
      }
    ],
    "metas": {
      "default": {
        "title": "Strassennamen",
        "title_en": "Strassennamen",
        "description": "<p>Der Datensatz umfasst Strassen und Plätze, welche durch eine Achse lokalisiert werden.<br>Die Achsen enthalten eine kurze Erläuterung zur Bedeutung der Strassennamen. Die Kurzerklärungen gibt es nur für Strassennamen der Stadt Basel. Die Felder zu den Erklärungen sind ausserhalb des Stadtgebietes leer.</p>",
        "theme": [
          "Geographie",
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Geography",
          "Territory and environment"
        ],
        "keyword": [
          "Nomenklatur",
          "Strasse",
          "Strassennetz",
          "Name"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-08-09T00:00:00+00:00",
        "records_count": 1456,
        "geometry_types": [
          "GeometryCollection",
          "LineString",
          "MultiLineString"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.6937919203192,
                  47.60077798739076
                ],
                [
                  7.555316928774118,
                  47.60077798739076
                ],
                [
                  7.555316928774118,
                  47.51977799925953
                ],
                [
                  7.6937919203192,
                  47.51977799925953
                ],
                [
                  7.6937919203192,
                  47.60077798739076
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Nomenklaturkommission",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/CONT"
      }
    }
  },
  {
    "dataset_id": "100199",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "messung_id",
        "type": "int",
        "label": "Messung-ID",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "strasse",
        "type": "text",
        "label": "Strasse",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "strasse_nr",
        "type": "text",
        "label": "Hausnummer"
      },
      {
        "name": "ort",
        "type": "text",
        "label": "Ort",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "the_geom",
        "type": "geo_shape",
        "label": "Koordinaten"
      },
      {
        "name": "extraordinary_traffic_routing",
        "type": "text",
        "label": "ausserordendliche Verkehrsführung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "min_timestamp",
        "type": "datetime",
        "label": "Anfangszeit",
        "annotations": {
          "facet": true,
          "timeserie_precision": "minute"
        }
      },
      {
        "name": "max_timestamp",
        "type": "datetime",
        "label": "Endzeit",
        "annotations": {
          "facet": true,
          "timeserie_precision": "minute"
        }
      },
      {
        "name": "messdauer_h",
        "type": "double",
        "label": "Messdauer (Stunden)"
      },
      {
        "name": "richtung_id",
        "type": "int",
        "label": "Richtung ID",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "richtung",
        "type": "text",
        "label": "Richtung"
      },
      {
        "name": "count",
        "type": "int",
        "label": "Anzahl Fahrzeuge"
      },
      {
        "name": "count_lt_3_5m",
        "type": "int",
        "label": "Anzahl Fahrzeuge bis 3.5 m"
      },
      {
        "name": "count_3_5_to_lt_8m",
        "type": "int",
        "label": "Anzahl Fahrzeuge zwischen 3.5 m und 8 m"
      },
      {
        "name": "count_gte_8m",
        "type": "int",
        "label": "Anzahl Fahrzeuge ab 8 m"
      },
      {
        "name": "dtv",
        "type": "double",
        "label": "Durchschnittlicher Tagesverkehr (DTV)"
      },
      {
        "name": "dtv_lt_3_5m",
        "type": "double",
        "label": "DTV Fahrzeuge bis 3.5 m"
      },
      {
        "name": "dtv_3_5_to_lt_8m",
        "type": "double",
        "label": "DTV Fahrzeuge zwischen 3.5 m und 8 m"
      },
      {
        "name": "dtv_gte_8m",
        "type": "double",
        "label": "DTV Fahrzeuge ab 8 m"
      },
      {
        "name": "link_zu_einzelmessungen",
        "type": "text",
        "label": "Einzelmessungen"
      },
      {
        "name": "min_timestamp_text",
        "type": "text",
        "label": "Anfangszeit (Text)"
      },
      {
        "name": "max_timestamp_text",
        "type": "text",
        "label": "Endzeit (Text)"
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "geo_point_2d"
      }
    ],
    "metas": {
      "default": {
        "title": "Durchschnittlicher Tagesverkehr (basierend auf dem Geschwindigkeitsmonitoring der Kantonspolizei)",
        "title_en": "Durchschnittlicher Tagesverkehr (basierend auf dem Geschwindigkeitsmonitoring der Kantonspolizei)",
        "description": "<p>Dieser Datensatz resultiert aus dem Daten des Geschwindigkeitsmonitorings der Kantonspolizei Basel-Stadt (siehe <a href=\"https://data.bs.ch/explore/dataset/100097/\" target=\"_blank\">https://data.bs.ch/explore/dataset/100097/</a>). Es wird zu jeder Messung und Richtung (ein Messgerät an einem Standort misst in zwei Richtungen) der durchschnittliche Tagesverkehr berechnet. </p><p>\n\nHinweis: Die Me",
        "theme": [
          "Mobilität und Verkehr",
          "Tourismus"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Tourism"
        ],
        "keyword": [
          "Verkehrszählung",
          "Verkehr",
          "Statistik",
          "Durchschnitt",
          "Tagesverkehr",
          "Belästigung",
          "Auslastung",
          "DTV"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T04:02:08.113000+00:00",
        "records_count": 1679,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.672548741102219,
                  47.59264087770134
                ],
                [
                  7.5567758828401566,
                  47.59264087770134
                ],
                [
                  7.5567758828401566,
                  47.52160986419767
                ],
                [
                  7.672548741102219,
                  47.52160986419767
                ],
                [
                  7.672548741102219,
                  47.59264087770134
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/DAILY",
        "temporal_coverage_start": "2018-01-01T23:00:00+00:00",
        "temporal_coverage_end": "2026-08-23T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100201",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geometrie"
      },
      {
        "name": "id",
        "type": "int",
        "label": "ID"
      },
      {
        "name": "parzellennummer",
        "type": "text",
        "label": "Parzellennummer"
      },
      {
        "name": "parzellenindex",
        "type": "text",
        "label": "Parzellenindex"
      },
      {
        "name": "egrid",
        "type": "text",
        "label": "Eidgenössischer Grundstücksidentifikator"
      },
      {
        "name": "sektionsname",
        "type": "text",
        "label": "Sektionsname"
      },
      {
        "name": "grundstuecksart",
        "type": "text",
        "label": "Grundstücksart"
      },
      {
        "name": "flaechenmass",
        "type": "int",
        "label": "Flächenmass",
        "annotations": {
          "unit": "m2"
        }
      },
      {
        "name": "gueltigkeit",
        "type": "text",
        "label": "Rechtsstatus"
      }
    ],
    "metas": {
      "default": {
        "title": "Liegenschaften: Parzellen",
        "title_en": "Liegenschaften: Parzellen",
        "description": "<p>Die Liegenschaften sind eine Informationsebene der amtlichen Vermessung, die alle Liegenschaften, flächenmässig ausgeschieden selbständigen und dauernen Rechte und Grenzpunkte enthält. Im kantonalen Modell von Basel-Stadt wird zwischen Liegenschaft und Allmendparzelle unterschieden. Zudem gibt es zusätzlich zum Baurecht auch Unterbaurechte.</p>",
        "theme": [
          "Geographie",
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Geography",
          "Territory and environment"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-08-20T00:00:00+00:00",
        "records_count": 24429,
        "geometry_types": [
          "MultiPolygon",
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.693801978603005,
                  47.60091796517372
                ],
                [
                  7.554659955203533,
                  47.60091796517372
                ],
                [
                  7.554659955203533,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.60091796517372
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Grundbuch- und Vermessungsamt",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/DAILY"
      }
    }
  },
  {
    "dataset_id": "100216",
    "has_records": true,
    "features": [
      "geo",
      "analyze",
      "timeserie",
      "custom_view"
    ],
    "fields": [
      {
        "name": "id_ufsp",
        "type": "text",
        "label": "Id-Unfallschwerpunkt"
      },
      {
        "name": "kategorie",
        "type": "text",
        "label": "Kategorie",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "kategoriebeschreibung",
        "type": "text",
        "label": "Beschreibung der Kategorie des Unfallschwerpunktes",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "jahr",
        "type": "date",
        "label": "Jahr",
        "annotations": {
          "facet": true,
          "timeserie_precision": "year"
        }
      },
      {
        "name": "strasse",
        "type": "text",
        "label": "Strasse"
      },
      {
        "name": "anlagetyp",
        "type": "text",
        "label": "Anlagetyp",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "lichtsign",
        "type": "text",
        "label": "Lichtsignalanlage",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "ortschaft",
        "type": "text",
        "label": "Gemeinde",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      }
    ],
    "metas": {
      "default": {
        "title": "Unfallschwerpunkte",
        "title_en": "Unfallschwerpunkte",
        "description": "Seit 2013 ist der Artikel 6a des Strassenverkehrsgesetz (SVG) in Kraft. Alle Strasseneigentümer werden darin unter anderem zur gebührenden Berücksichtigung der Verkehrssicherheitsaspekte bei Planung, Bau, Unterhalt und Betrieb von Strassen sowie zur Analyse des Strassennetzes auf Unfallschwerpunkte (USP) verpflichtet. Die Analyse der USP erfolgt gemäss der Schweizer Norm SN 641 724 des Schweizeris",
        "theme": [
          "Mobilität und Verkehr",
          "Öffentliche Ordnung und Sicherheit",
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Public order and security",
          "Territory and environment"
        ],
        "keyword": [
          "Verkehrsunfall",
          "Fussgänger",
          "Schaden",
          "Gefährdung",
          "Velo",
          "Auto",
          "Motorräder",
          "Unfall",
          "Verkehrsunfälle"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2026-09-02T00:00:00+00:00",
        "records_count": 187,
        "geometry_types": [
          "Point"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.649192987009883,
                  47.58347279392183
                ],
                [
                  7.5573743507266045,
                  47.58347279392183
                ],
                [
                  7.5573743507266045,
                  47.53664821386337
                ],
                [
                  7.649192987009883,
                  47.53664821386337
                ],
                [
                  7.649192987009883,
                  47.58347279392183
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Kantonspolizei",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/ANNUAL",
        "temporal_coverage_start": "2018-12-31T23:00:00+00:00",
        "temporal_coverage_end": "2025-12-30T23:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100242",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geometrie"
      },
      {
        "name": "id_durchgangsstrasse",
        "type": "int",
        "label": "ID Strasse"
      },
      {
        "name": "durchgangsstrassennummer",
        "type": "text",
        "label": "Durchgangsstrassennummer"
      },
      {
        "name": "durchgangsstrassentyp",
        "type": "text",
        "label": "Durchgangsstrassentyp"
      },
      {
        "name": "strecke",
        "type": "text",
        "label": "Strecke"
      },
      {
        "name": "bemerkungen",
        "type": "text",
        "label": "Bemerkungen"
      }
    ],
    "metas": {
      "default": {
        "title": "Strassen und Wege: Durchgangsstrassen",
        "title_en": "Strassen und Wege: Durchgangsstrassen",
        "description": "<p>Der Datensatz beinhaltet die Durchgangsstrassen gemäss eidgenössischer Durchgangsstrassenverordung (741.272).</p><p>Weitere Daten zu \"Strassen und Wege\": <a href=\"https://data.bs.ch/explore/?refine.tags=STWE\" target=\"_blank\">https://data.bs.ch/explore/?refine.tags=STWE</a></p>",
        "theme": [
          "Mobilität und Verkehr",
          "Geographie"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Geography"
        ],
        "keyword": [
          "Durchgangsstrassen",
          "Erschliessungsstrasse",
          "Europastrasse",
          "Feldweg",
          "Gasse",
          "Geschwindigkeit",
          "Hauptstrasse",
          "Hierarchie",
          "HLS",
          "Hochleistungsstrasse",
          "HSS",
          "HVS",
          "Kantonsstrassen",
          "Mobilität",
          "Mobilitätsnetz",
          "Nationalstrasse",
          "Netz",
          "Parkanlage",
          "Promenade",
          "QSS",
          "Quartiersammelstrasse",
          "Strassennetzhierarchie",
          "Temporegime",
          "Verkehrsorientierte",
          "Waldweg",
          "Weg",
          "Strassennetz",
          "Wegnetz"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-06-09T00:00:00+00:00",
        "records_count": 36,
        "geometry_types": [
          "LineString"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.67202696762979,
                  47.59527296293527
                ],
                [
                  7.557025998830795,
                  47.59527296293527
                ],
                [
                  7.557025998830795,
                  47.53042398020625
                ],
                [
                  7.67202696762979,
                  47.53042398020625
                ],
                [
                  7.67202696762979,
                  47.59527296293527
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/AS_NEEDED"
      }
    }
  },
  {
    "dataset_id": "100249",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "id_ksrb",
        "type": "int",
        "label": "Id_KS_Riehen_Bettingen"
      },
      {
        "name": "gemeinde",
        "type": "text",
        "label": "Gemeinde",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "eigentum",
        "type": "text",
        "label": "Eigentum",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "strasse",
        "type": "text",
        "label": "Strasse"
      }
    ],
    "metas": {
      "default": {
        "title": "Strassen und Wege: Kantonsstrassen Riehen und Bettingen",
        "title_en": "Strassen und Wege: Kantonsstrassen Riehen und Bettingen",
        "description": "Dieser Datensatz ist Teil des kantonalen Geodatenmodells des Kantons Basel-Stadt \"Strassen und Wege\" und stellt die Kantonsstrassen Riehen und Bettingen dar. <br>Weitere Daten zu \"Strassen und Wege\":<a href=\"https://data.bs.ch/explore/?refine.tags=Strassen+und+Wege\">https://data.bs.ch/explore/?refine.tags=Strassen+und+Wege</a><br>\nDie Kantonsstrassen Riehen und Bettingen zeigen die Kantonsstrassen",
        "theme": [
          "Geographie",
          "Mobilität und Verkehr"
        ],
        "theme_en": [
          "Geography",
          "Mobility and Transport"
        ],
        "keyword": [
          "Weg",
          "Mobilität",
          "Strassennetz",
          "Strasse",
          "Wegnetz"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2024-10-31T00:00:00+00:00",
        "records_count": 13,
        "geometry_types": [
          "LineString"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.689643716439605,
                  47.595273004844785
                ],
                [
                  7.621475709602237,
                  47.595273004844785
                ],
                [
                  7.621475709602237,
                  47.562267165631056
                ],
                [
                  7.689643716439605,
                  47.562267165631056
                ],
                [
                  7.689643716439605,
                  47.595273004844785
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität",
        "territory": [
          "Riehen",
          "Bettingen"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG"
      }
    }
  },
  {
    "dataset_id": "100250",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geometrie"
      },
      {
        "name": "id_strasse_weg",
        "type": "int",
        "label": "ID Strasse"
      },
      {
        "name": "strassennummer",
        "type": "int",
        "label": "Strassennummer"
      },
      {
        "name": "strassenname",
        "type": "text",
        "label": "Strassenname"
      },
      {
        "name": "gemeinde",
        "type": "text",
        "label": "Name"
      },
      {
        "name": "strassennetzhierarchie_code",
        "type": "text",
        "label": "Strassennetzhierarchie Code"
      },
      {
        "name": "strassennetzhierarchie_text",
        "type": "text",
        "label": "Strassennetzhierarchie Text"
      },
      {
        "name": "strassenkategorie",
        "type": "text",
        "label": "Strassenkategorie"
      },
      {
        "name": "wegkategorie",
        "type": "text",
        "label": "Wegkategorie"
      },
      {
        "name": "geschwindigkeit",
        "type": "int",
        "label": "Signalisierte Geschwindigkeit"
      },
      {
        "name": "regime",
        "type": "text",
        "label": "Temporegime"
      },
      {
        "name": "strassenlaenge",
        "type": "double",
        "label": "Strassenlänge"
      },
      {
        "name": "strassenabschnittslaenge",
        "type": "double",
        "label": "Strassenabschnittslänge"
      },
      {
        "name": "zulassung_velo",
        "type": "text",
        "label": "Zulassung Velo"
      },
      {
        "name": "eigentuemer",
        "type": "text",
        "label": "Strasseneigentümer"
      }
    ],
    "metas": {
      "default": {
        "title": "Strassen und Wege: Strassentypen und Wege",
        "title_en": "Strassen und Wege: Strassentypen und Wege",
        "description": "<p>Der Datensatz beinhaltet das Mobilitätsnetz Basel-Stadt sowie die Strassennetzhierarchie des Kantons Basel-Stadt.</p><p>Weitere Daten zu \"Strassen und Wege\": <a href=\"https://data.bs.ch/explore/?refine.tags=STWE\" target=\"_blank\">https://data.bs.ch/explore/?refine.tags=STWE </a></p>",
        "theme": [
          "Mobilität und Verkehr",
          "Geographie"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Geography"
        ],
        "keyword": [
          "Durchgangsstrassen",
          "Erschliessungsstrasse",
          "Europastrasse",
          "Feldweg",
          "Gasse",
          "Geschwindigkeit",
          "Hauptstrasse",
          "Hierarchie",
          "HLS",
          "Hochleistungsstrasse",
          "HSS",
          "HVS",
          "Kantonsstrassen",
          "Mobilität",
          "Mobilitätsnetz",
          "Nationalstrasse",
          "Netz",
          "Parkanlage",
          "Promenade",
          "QSS",
          "Quartiersammelstrasse",
          "Strassennetzhierarchie",
          "Temporegime",
          "Verkehrsorientierte",
          "Waldweg",
          "Weg",
          "Strassennetz",
          "Wegnetz"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-06-09T00:00:00+00:00",
        "records_count": 0,
        "publisher": "Amt für Mobilität",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/AS_NEEDED"
      }
    }
  },
  {
    "dataset_id": "100251",
    "has_records": true,
    "features": [
      "geo",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "id_fussgaengerzone",
        "type": "int",
        "label": "Fussgängerzonen-ID"
      },
      {
        "name": "vr_regime",
        "type": "text",
        "label": "Regime"
      },
      {
        "name": "vr_name",
        "type": "text",
        "label": "Name"
      },
      {
        "name": "map_links",
        "type": "text",
        "label": "Zum Objekt navigieren"
      }
    ],
    "metas": {
      "default": {
        "title": "Verkehrsberuhigte Zonen: Fussgängerzone",
        "title_en": "Verkehrsberuhigte Zonen: Fussgängerzone",
        "description": "Dieser Datensatz beinhaltet die signalisierten Fussgängerzonen.\nDie verkehrsberuhigten Zonen setzen sich aus Fussgängerzonen, Begegnungszonen und Tempo 30-Zonen zusammen. Ebenso ist der Perimeter des Verkehrskonzepts Innenstadt mit der Kernzone mit eingeschränktem Motorfahrzeugverkehr dargestellt.<br>\nWeitere Daten zu \"Verkehrsberuhigte Zonen\":<a href=\"https://data.bs.ch/explore/?refine.tags=Verke",
        "theme": [
          "Geographie",
          "Mobilität und Verkehr"
        ],
        "theme_en": [
          "Geography",
          "Mobility and Transport"
        ],
        "keyword": [
          "Geschwindigkeitsbeschränkun",
          "Fussgänger",
          "Fussgängerzonen"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2026-08-17T00:00:00+00:00",
        "records_count": 48,
        "geometry_types": [
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.651957422494888,
                  47.58629049640149
                ],
                [
                  7.585106715559959,
                  47.58629049640149
                ],
                [
                  7.585106715559959,
                  47.55168283358216
                ],
                [
                  7.651957422494888,
                  47.55168283358216
                ],
                [
                  7.651957422494888,
                  47.58629049640149
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG"
      }
    }
  },
  {
    "dataset_id": "100252",
    "has_records": true,
    "features": [
      "geo",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "id_tempo30",
        "type": "int",
        "label": "ID Tempo 30-Zonen"
      },
      {
        "name": "vr_regime",
        "type": "text",
        "label": "Regime"
      },
      {
        "name": "vr_umsetzjahr",
        "type": "text",
        "label": "Umsetzungsjahr"
      },
      {
        "name": "map_links",
        "type": "text",
        "label": "Zum Objekt navigieren"
      }
    ],
    "metas": {
      "default": {
        "title": "Verkehrsberuhigte Zonen: Tempo 30 - Zone",
        "title_en": "Verkehrsberuhigte Zonen: Tempo 30 - Zone",
        "description": "Dieser Datensatz beinhaltet die signalisierten Fussgängerzonen.\nDie verkehrsberuhigten Zonen setzen sich aus Fussgängerzonen, Begegnungszonen und Tempo 30-Zonen zusammen. Ebenso ist der Perimeter des Verkehrskonzepts Innenstadt mit der Kernzone mit eingeschränktem Motorfahrzeugverkehr dargestellt.<br>\nWeitere Daten zu \"Verkehrsberuhigte Zonen\": <a href=\"https://data.bs.ch/explore/?refine.tags=Verk",
        "theme": [
          "Geographie",
          "Mobilität und Verkehr"
        ],
        "theme_en": [
          "Geography",
          "Mobility and Transport"
        ],
        "keyword": [
          "Geschwindigkeitsbeschränkun",
          "Fussgänger",
          "Fussgängerzonen"
        ],
        "license": "CC BY 4.0 + OpenStreetMap",
        "license_url": "https://data-bs.ch/stata/dataspot/permalinks/20240822-osm-vektordaten.pdf",
        "modified": "2026-08-17T00:00:00+00:00",
        "records_count": 187,
        "geometry_types": [
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.684730160981417,
                  47.59550463873893
                ],
                [
                  7.555868625640869,
                  47.59550463873893
                ],
                [
                  7.555868625640869,
                  47.52379737328738
                ],
                [
                  7.684730160981417,
                  47.52379737328738
                ],
                [
                  7.684730160981417,
                  47.59550463873893
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG"
      }
    }
  },
  {
    "dataset_id": "100269",
    "has_records": true,
    "features": [
      "timeserie",
      "analyze"
    ],
    "fields": [
      {
        "name": "timestamp_text",
        "type": "datetime",
        "label": "Zeitstempel",
        "annotations": {
          "facet": true,
          "id": true,
          "timeserie_precision": "hour"
        }
      },
      {
        "name": "temperatur",
        "type": "double",
        "label": "Temperatur",
        "annotations": {
          "unit": "°C"
        }
      }
    ],
    "metas": {
      "default": {
        "title": "Temperatur Wiese",
        "title_en": "Temperatur Wiese",
        "description": "<p>Der Datensatz zeigt die stündlichen Temperaturwerte der Wiese an.</p><p>Koordinaten: <a href=\"https://map.geo.bs.ch/?lang=de&amp;baselayer_ref=Grundkarte%20farbig&amp;map_x=2611543&amp;map_y=1270112&amp;map_zoom=8&amp;rl_features=Fp(fjytj-wy78T~n*Standort'c*%2523DB4436'a*0'o*0.2'm*false'b*false's*14'k*2)\" target=\"_blank\">47.581638577259945, 7.59193858146811</a></p>",
        "theme": [
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Territory and environment"
        ],
        "keyword": [
          "Fluss"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T20:30:15.058000+00:00",
        "records_count": 31048,
        "publisher": "Tiefbauamt",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/HOURLY",
        "temporal_coverage_start": "2023-01-23T23:00:00+00:00",
        "temporal_coverage_end": "2026-08-31T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100278",
    "has_records": true,
    "features": [
      "analyze",
      "geo"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geo Shape"
      },
      {
        "name": "id",
        "type": "int",
        "label": "ID"
      },
      {
        "name": "beschreibung",
        "type": "text",
        "label": "Beschreibung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "beschreibung_en",
        "type": "text",
        "label": "Beschreibung EN"
      }
    ],
    "metas": {
      "default": {
        "title": "Fischereiverbotszonen Rhein",
        "title_en": "Fischereiverbotszonen Rhein",
        "description": "<p>Der Datensatz beinhaltet die Zonen innerhalb des Kantons Basel-Stadt, in welchen das Fischen nicht erlaubt ist. </p>",
        "theme": [
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Territory and environment"
        ],
        "keyword": [
          "Angeln",
          "Fischen"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2025-04-28T07:46:52.289000+00:00",
        "records_count": 7,
        "geometry_types": [
          "MultiPolygon",
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.6282706670463085,
                  47.58962326683104
                ],
                [
                  7.583122048527002,
                  47.58962326683104
                ],
                [
                  7.583122048527002,
                  47.554498189128935
                ],
                [
                  7.6282706670463085,
                  47.554498189128935
                ],
                [
                  7.6282706670463085,
                  47.58962326683104
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Umwelt und Energie",
        "territory": [
          "Switzerland",
          "Germany"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG"
      }
    }
  },
  {
    "dataset_id": "100288",
    "has_records": true,
    "features": [
      "timeserie",
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "datenstand",
        "type": "date",
        "label": "Datenstand",
        "annotations": {
          "timeserie_precision": "month",
          "facet": true
        }
      },
      {
        "name": "id",
        "type": "text",
        "label": "ID Strassenabschnitt"
      },
      {
        "name": "strasse",
        "type": "text",
        "label": "Strassenabschnitt",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "cci",
        "type": "double",
        "label": "CCI",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "anzahl_messungen",
        "type": "int",
        "label": "Anzahl Messungen",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "letzte_messung",
        "type": "datetime",
        "label": "Letzte Messung",
        "annotations": {
          "facet": true,
          "timeserie_precision": "minute"
        }
      },
      {
        "name": "geometry",
        "type": "geo_shape",
        "label": "Geometry"
      },
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "geo_point_2d"
      }
    ],
    "metas": {
      "default": {
        "title": "Sauberkeitsindex pro Monat und Strassenabschnitt",
        "title_en": "Sauberkeitsindex pro Monat und Strassenabschnitt",
        "description": "<p class=\"\">Dieser Datensatz enthält den Sauberkeitsindex für alle Strassenabschnitte in der Stadt Basel. Zur Berechnung des Sauberkeitsindex wird wie folgt vorgegangen:</p><p>Auf den Kehrrichtfahrzeugen sind Kameras installiert, die während der Einsätze Videoaufnahmen der Strassen machen. Ein Computer durchsucht anschliessend diese Videoaufnahmen nach Abfällen. Dieser sortiert die Abfälle in vers",
        "theme": [
          "Öffentliche Ordnung und Sicherheit",
          "Raum und Umwelt",
          "Bevölkerung"
        ],
        "theme_en": [
          "Public order and security",
          "Territory and environment",
          "Population"
        ],
        "keyword": [
          "Sauberkeit",
          "Kehrricht",
          "Abfall",
          "Reinigung",
          "Stadtreinigung",
          "Strassennetz",
          "Stadthygiene",
          "Verschmutzung",
          "Müll"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-01T07:01:41.884000+00:00",
        "records_count": 143022,
        "geometry_types": [
          "LineString",
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.635168386623263,
                  47.59264117106795
                ],
                [
                  7.554902946576476,
                  47.59264117106795
                ],
                [
                  7.554902946576476,
                  47.51850759610534
                ],
                [
                  7.635168386623263,
                  47.51850759610534
                ],
                [
                  7.635168386623263,
                  47.59264117106795
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Stadtreinigung",
        "territory": [
          "Basel"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/MONTHLY",
        "temporal_coverage_start": "2024-02-06T23:00:00+00:00",
        "temporal_coverage_end": "2026-08-30T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100335",
    "has_records": true,
    "features": [
      "timeserie",
      "analyze"
    ],
    "fields": [
      {
        "name": "projekt_name",
        "type": "text",
        "label": "Strasse - Projektname",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "projekt_beschrieb",
        "type": "text",
        "label": "Beschreibung"
      },
      {
        "name": "projekt_info",
        "type": "text",
        "label": "Zusatzinformationen"
      },
      {
        "name": "projekt_link",
        "type": "text",
        "label": "Weblink Projekt"
      },
      {
        "name": "datum_von",
        "type": "date",
        "label": "Baubeginn",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "datum_bis",
        "type": "date",
        "label": "Bauende",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "dokument1",
        "type": "text",
        "label": "Dokument 1"
      },
      {
        "name": "dokument2",
        "type": "text",
        "label": "Dokument 2"
      },
      {
        "name": "dokument3",
        "type": "text",
        "label": "Dokument 3"
      },
      {
        "name": "id",
        "type": "int",
        "label": "Fallnummer Allmendbewilligung"
      },
      {
        "name": "allmendbewilligungen",
        "type": "text",
        "label": "Weblink Allmendbewilligung"
      }
    ],
    "metas": {
      "default": {
        "title": "Baustellen",
        "title_en": "Baustellen",
        "description": "<p>Dieser Datensatz enthält umfassende Informationen zu aktuellen und bevorstehende Baustellen (Baubewilligung erteilt) auf öffentlichem Grund im Kanton Basel-Stadt. Er enthält Informationen wie z. B. an welcher Strasse sich die Baustelle befindet, die Beschreibung des Projektes, mögliche Zusatzinformationen, Links zum Projekt und zu Anwohnerinformationen. Die Fallnummer der Allmendbewilligung und",
        "theme": [
          "Bau- und Wohnungswesen"
        ],
        "theme_en": [
          "Construction and housing"
        ],
        "keyword": [
          "Baustelle",
          "bauen",
          "Strasse",
          "Allmendbewilligung",
          "Baubeginn",
          "Bauende"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T06:01:09.491000+00:00",
        "records_count": 96,
        "publisher": "Tiefbauamt",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/IRREG"
      }
    }
  },
  {
    "dataset_id": "100356",
    "has_records": true,
    "features": [
      "timeserie",
      "analyze",
      "custom_view"
    ],
    "fields": [
      {
        "name": "zst_id",
        "type": "text",
        "label": "Standort-ID",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "sitename",
        "type": "text",
        "label": "Standortname",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "directionname",
        "type": "text",
        "label": "Richtung",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "lanecode",
        "type": "text",
        "label": "Spurnummer",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "lanename",
        "type": "text",
        "label": "Spurname",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "date",
        "type": "date",
        "label": "Datum",
        "annotations": {
          "facet": true,
          "timeserie_precision": "day"
        }
      },
      {
        "name": "timefrom",
        "type": "text",
        "label": "Messbeginn Uhrzeit",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "timeto",
        "type": "text",
        "label": "Messende Uhrzeit",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "traffictype",
        "type": "text",
        "label": "Verkehrsart",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "total",
        "type": "int",
        "label": "Total"
      },
      {
        "name": "20",
        "type": "int",
        "label": "<20km/h"
      },
      {
        "name": "20_30",
        "type": "int",
        "label": "20-30km/h"
      },
      {
        "name": "30_40",
        "type": "int",
        "label": "30-40km/h"
      },
      {
        "name": "40_50",
        "type": "int",
        "label": "40-50km/h"
      },
      {
        "name": "50_60",
        "type": "int",
        "label": "50-60km/h"
      },
      {
        "name": "60_70",
        "type": "int",
        "label": "60-70km/h"
      },
      {
        "name": "70_80",
        "type": "int",
        "label": "70-80km/h"
      },
      {
        "name": "80_90",
        "type": "int",
        "label": "80-90km/h"
      },
      {
        "name": "90_100",
        "type": "int",
        "label": "90-100km/h"
      },
      {
        "name": "100_110",
        "type": "int",
        "label": "100-110km/h"
      },
      {
        "name": "110_120",
        "type": "int",
        "label": "110-120km/h"
      },
      {
        "name": "120_130",
        "type": "int",
        "label": "120-130km/h"
      },
      {
        "name": "130",
        "type": "int",
        "label": ">130km/h"
      },
      {
        "name": "datetimefrom",
        "type": "datetime",
        "label": "Messbeginn Zeitpunkt",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "datetimeto",
        "type": "datetime",
        "label": "Messende Zeitpunkt",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "year",
        "type": "text",
        "label": "Jahr",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "month",
        "type": "text",
        "label": "Monat",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "day",
        "type": "text",
        "label": "Tag",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "weekday",
        "type": "text",
        "label": "Wochentag",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "hourfrom",
        "type": "text",
        "label": "Stunde",
        "annotations": {
          "facet": true
        }
      },
      {
        "name": "dayofyear",
        "type": "int",
        "label": "Tag des Jahres"
      }
    ],
    "metas": {
      "default": {
        "title": "Geschwindigkeitsklassen motorisierter Individualverkehr",
        "title_en": "Geschwindigkeitsklassen motorisierter Individualverkehr",
        "description": "<p>Dieser Datensatz enthält die Geschwindigkeitsklassen des motorisierten Individualverkehrs. Die Daten werden vor der Veröffentlichung nicht überprüft oder ergänzt. Daher können jederzeit Datenlücken oder falsche Messungen aufgrund technischer Probleme oder Verkehrsbehinderungen auftreten.</p><p>Aus Kostengründen sind nur die Werte des aktuellen Jahres und der letzten zwei Jahre als Tabelle / Vis",
        "theme": [
          "Mobilität und Verkehr"
        ],
        "theme_en": [
          "Mobility and Transport"
        ],
        "keyword": [
          "Auto",
          "Motorrad",
          "Bus",
          "Lieferwagen",
          "Lastwagen",
          "Anhänger",
          "Verkehr",
          "Geschwindigkeit",
          "km/h"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-09-02T06:51:29.586000+00:00",
        "records_count": 1387776,
        "publisher": "Amt für Mobilität",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/DAILY",
        "temporal_coverage_start": "2023-12-30T23:00:00+00:00",
        "temporal_coverage_end": "2026-08-29T22:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100357",
    "has_records": true,
    "features": [
      "analyze"
    ],
    "fields": [
      {
        "name": "jahr",
        "type": "text",
        "label": "Jahr",
        "annotations": {
          "timeserie_precision": "day",
          "facet": true
        }
      },
      {
        "name": "url_png",
        "type": "text",
        "label": "URL PNG"
      },
      {
        "name": "url_pgw",
        "type": "text",
        "label": "URL Weltdatei"
      },
      {
        "name": "url_tif",
        "type": "text",
        "label": "URL TIF"
      }
    ],
    "metas": {
      "default": {
        "title": "Baumkronenbedeckung",
        "title_en": "Baumkronenbedeckung",
        "description": "<p>Dieser Datensatz zeigt die gesamte durch Bäume beschattete Fläche (Baumkronenbedeckung) im Kanton Basel-Stadt in verschiedenen Jahren. Der Kanton Basel-Stadt erhebt durch Laserabtastung der Oberfläche (LiDAR) Daten zur Baumkronenbedeckung (durch Bäume beschattete Fläche) über die gesamte Kantonsfläche. Die von LiDAR abgeleitete Baumkronenbedeckung und Kennzahlen wurden für 2012, 2021 und 2024 b",
        "theme": [
          "Raum und Umwelt",
          "Geographie"
        ],
        "theme_en": [
          "Territory and environment",
          "Geography"
        ],
        "keyword": [
          "Baum",
          "Baumbestand",
          "Baumkrone",
          "Kronenbedeckung",
          "Vegetation",
          "LiDAR"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-02-07T10:39:24.760000+00:00",
        "records_count": 3,
        "publisher": "Stadtgärtnerei",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/TRIENNIAL",
        "temporal_coverage_start": "2012-12-30T23:00:00+00:00"
      }
    }
  },
  {
    "dataset_id": "100426",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geometrie"
      },
      {
        "name": "klassifikation",
        "type": "text",
        "label": "Klassifikation"
      }
    ],
    "metas": {
      "default": {
        "title": "Velostadtplan: Eignung",
        "title_en": "Velostadtplan: Eignung",
        "description": "<p>Der Datensatz beschreibt, wie gut sich einzelne Strassenabschnitte zum Velofahren eignen. Die Eignung kann je nach Infrastruktur auf demselben Strassenabschnitt zwischen den beiden Fahrtrichtungen variieren.</p>",
        "theme": [
          "Mobilität und Verkehr",
          "Geographie",
          "Tourismus"
        ],
        "theme_en": [
          "Mobility and Transport",
          "Geography",
          "Tourism"
        ],
        "keyword": [
          "Fahrrad",
          "Velo",
          "Veloroutennetz"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-08-18T00:00:00+00:00",
        "records_count": 5354,
        "geometry_types": [
          "LineString"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.716497993096709,
                  47.60765596758574
                ],
                [
                  7.481762962415814,
                  47.60765596758574
                ],
                [
                  7.481762962415814,
                  47.50789497513324
                ],
                [
                  7.716497993096709,
                  47.50789497513324
                ],
                [
                  7.716497993096709,
                  47.60765596758574
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Amt für Mobilität",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {
        "accrualperiodicity": "http://publications.europa.eu/resource/authority/frequency/AS_NEEDED"
      }
    }
  },
  {
    "dataset_id": "100477",
    "has_records": true,
    "features": [
      "geo",
      "analyze"
    ],
    "fields": [
      {
        "name": "geo_point_2d",
        "type": "geo_point_2d",
        "label": "Geo Point"
      },
      {
        "name": "geo_shape",
        "type": "geo_shape",
        "label": "Geometrie"
      },
      {
        "name": "id",
        "type": "int",
        "label": "ID"
      },
      {
        "name": "bodenbedeckungsart",
        "type": "text",
        "label": "Bodenbedeckungsart"
      }
    ],
    "metas": {
      "default": {
        "title": "Bodenbedeckung",
        "title_en": "Bodenbedeckung",
        "description": "<p>Die Bodenbedeckung ist eine Informationsebene der amtlichen Vermessung, in der Objekte wie Gebäude, befestigte Flächen, humusierte Flächen, Wasserflächen, bestockte Flächen und vegetationslose Flächen zusammengefasst sind.</p>",
        "theme": [
          "Geographie",
          "Raum und Umwelt"
        ],
        "theme_en": [
          "Geography",
          "Territory and environment"
        ],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "modified": "2026-08-20T00:00:00+00:00",
        "records_count": 49592,
        "geometry_types": [
          "GeometryCollection",
          "MultiPolygon",
          "Polygon"
        ],
        "bbox": {
          "type": "Feature",
          "geometry": {
            "coordinates": [
              [
                [
                  7.693801978603005,
                  47.60091796517372
                ],
                [
                  7.554659955203533,
                  47.60091796517372
                ],
                [
                  7.554659955203533,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.51929696183652
                ],
                [
                  7.693801978603005,
                  47.60091796517372
                ]
              ]
            ],
            "type": "Polygon"
          },
          "properties": {}
        },
        "publisher": "Grundbuch- und Vermessungsamt",
        "territory": [
          "Basel-Stadt"
        ]
      },
      "dcat": {}
    }
  }
];

export const fallbackDatasets: DatasetRecord[] = FALLBACK_ENTRIES
  .map(normalizeOdsDataset)
  .filter((record): record is DatasetRecord => record !== null);

export class FallbackCatalogueAdapter implements CatalogueAdapter {
  readonly id = 'basel-fallback';
  readonly label = 'Basel-Stadt fallback set (offline snapshot)';

  private entriesById = new Map(
    FALLBACK_ENTRIES.map(entry => [String((entry as { dataset_id?: string }).dataset_id), entry] as const),
  );

  async listDatasets(): Promise<DatasetRecord[]> {
    return fallbackDatasets;
  }

  async getDataset(id: string): Promise<DatasetRecord> {
    const record = fallbackDatasets.find(dataset => dataset.id === id);
    if (!record) throw new Error(`Dataset ${id} is not in the fallback set`);
    return record;
  }

  /** `options` is accepted for interface parity; sampling is impossible offline. */
  async inspectDataset(id: string, options: InspectOptions = {}): Promise<DatasetStructure> {
    const entry = this.entriesById.get(id);
    if (!entry) throw new Error(`Dataset ${id} is not in the fallback set`);
    const structure = structureFromCatalogEntry(entry);
    return options.sample
      ? {
          ...structure,
          notes: [...structure.notes, 'Fallback mode: no records are available, so no sample evidence was gathered.'],
        }
      : structure;
  }
}
