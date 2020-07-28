import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('This customer does not exists');
    }

    const productsSaved = await this.productsRepository.findAllById(products);

    const updateQuantityProducts: IProduct[] = [];

    const orderProducts = products.map(product => {
      const currentProduct = productsSaved.find(prod => prod.id === product.id);

      if (!currentProduct) {
        throw new AppError('One or more products in order do not exist');
      }

      if (product.quantity > currentProduct.quantity) {
        throw new AppError(
          'One or more products have an insufficient quantity available',
        );
      }

      const { id, price } = currentProduct;
      const { quantity } = product;

      updateQuantityProducts.push({
        id,
        quantity: currentProduct.quantity - quantity,
      });

      return { product_id: id, price, quantity };
    });

    const newOrders = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    await this.productsRepository.updateQuantity(updateQuantityProducts);

    return newOrders;
  }
}

export default CreateOrderService;
