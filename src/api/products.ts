import axios, { endpoints } from 'src/utils/axios';
import {
  IProduct,
  IProductChild,
  IProductListItem,
  IPagedResult,
  ICreateProductRequest,
  IUpdateProductRequest,
  IProductVariant,
  IProductUnitConversion,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

/**
 * Maps backend ProductResponse (old KiotViet schema) to include the extended
 * new-schema alias fields so downstream UI components work correctly.
 */
function mapProductResponse(p: IProduct): IProduct {
  const totalStock =
    p.totalStock ?? p.inventories?.reduce((sum, inv) => sum + (inv.onHand || 0), 0) ?? 0;

  // Map childProducts → variants + unitConversions
  let variants: IProductVariant[] | undefined = p.variants;
  let unitConversions: IProductUnitConversion[] | undefined = p.unitConversions;

  if (!variants && p.childProducts && p.childProducts.length > 0) {
    const variantChildren: IProductVariant[] = [];
    const unitConvChildren: IProductUnitConversion[] = [];

    p.childProducts.forEach((child) => {
      if (child.conversionValue && child.conversionValue > 0) {
        // This is a unit conversion child
        unitConvChildren.push({
          unitOfMeasureId: child.id,
          unitOfMeasureName: child.name,
          conversionRate: child.conversionValue,
          costPrice: child.basePrice,
          sellingPrice: child.basePrice,
          barcode: child.barCode || '',
        });
      } else if (child.attributes && child.attributes.length > 0) {
        // This is a variant child (has attributes)
        const childStock = child.inventories?.reduce((s, inv) => s + (inv.onHand || 0), 0) ?? 0;
        variantChildren.push({
          id: child.id,
          name: child.name,
          sku: child.code,
          barcode: child.barCode,
          costPrice: child.basePrice,
          sellingPrice: child.basePrice,
          totalStock: childStock,
          isActive: child.isActive,
          combinations: child.attributes.map((a) => ({
            attributeId: a.id,
            attributeName: a.attributeName,
            valueId: a.id,
            valueName: a.attributeValue,
          })),
        });
      }
    });

    if (variantChildren.length > 0) variants = variantChildren;
    if (unitConvChildren.length > 0) unitConversions = unitConvChildren;
  }

  return {
    ...p,
    sku: p.sku ?? p.code,
    barcode: p.barcode ?? p.barCode,
    costPrice: p.costPrice ?? p.basePrice,
    sellingPrice: p.sellingPrice ?? p.basePrice,
    vatRate: p.vatRate ?? p.taxRateDirect ?? (p.taxRate ? parseFloat(p.taxRate) : 0),
    imageUrl: p.imageUrl ?? p.images?.[0]?.imageUrl,
    totalStock,
    unitOfMeasureName: p.unitOfMeasureName ?? p.unit,
    lowStockThreshold: p.lowStockThreshold ?? p.minQuantity,
    highStockThreshold: p.highStockThreshold ?? p.maxQuantity,
    isLoyaltyPoints: p.isLoyaltyPoints ?? p.isRewardPoint,
    createdAt: p.createdAt ?? p.createdDate,
    updatedAt: p.updatedAt ?? p.modifiedDate,
    variants,
    unitConversions,
  };
}

/**
 * Maps backend ProductListItemResponse to include extended alias fields.
 */
function mapProductListItem(p: IProductListItem): IProductListItem {
  const totalStock =
    p.totalStock ?? p.inventories?.reduce((sum, inv) => sum + (inv.onHand || 0), 0) ?? 0;

  return {
    ...p,
    sku: p.sku ?? p.code,
    barcode: p.barcode ?? p.barCode,
    costPrice: p.costPrice ?? p.basePrice,
    sellingPrice: p.sellingPrice ?? p.basePrice,
    totalStock,
  };
}

export async function getAllProducts(params?: {
  keyword?: string;
  categoryId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<IPagedResult<IProductListItem>> {
  const response = await axios.get<IPagedResult<IProductListItem>>(endpoints.products.list, { params });
  return {
    ...response.data,
    items: response.data.items.map(mapProductListItem),
  };
}

export async function getChildProducts(parentId: string): Promise<IProductChild[]> {
  const response = await axios.get<IProductChild[]>(`${endpoints.products.details(parentId)}/children`);
  return response.data;
}

export async function getProductById(id: string): Promise<IProduct> {
  const response = await axios.get<IProduct>(endpoints.products.details(id));
  return mapProductResponse(response.data);
}

export async function createProduct(data: ICreateProductRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.products.create, data);
  return response.data;
}

export async function updateProduct(id: string, data: IUpdateProductRequest): Promise<void> {
  await axios.put(endpoints.products.update(id), data);
}

export async function deleteProduct(id: string): Promise<void> {
  await axios.delete(endpoints.products.delete(id));
}

export async function syncKiotViet(): Promise<unknown> {
  const response = await axios.post(endpoints.kiotViet.sync);
  return response.data;
}
