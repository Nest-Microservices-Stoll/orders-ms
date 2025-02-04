import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { PRODUCT_MICROSERVICE } from 'src/common/services/services';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger(OrdersService.name);


  constructor(
    @Inject(PRODUCT_MICROSERVICE) private readonly productCLient: ClientProxy
  ) {
    super()
  }

  async onModuleInit() {
    await this.$connect()
    this.logger.log('Connected to database')

  }
  async create(createOrderDto: CreateOrderDto) {




    try {

      // Confirm the ids of products
      const productsId = createOrderDto.items.map(item => item.productId)
      const products = await firstValueFrom(this.productCLient.send({ cmd: 'validate_product' }, productsId))



      // Calculate values from details

      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {

        const price = products.find(product => product.id === orderItem.productId).price
        return price * orderItem.quantity + acc
      }, 0)

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity
      }, 0)

      // Create a transaction db

      const order = await this.order.create({
        data: {
          totalAmount: totalAmount,
          totalItems: totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((orderItem) => ({
                price: products.find(prod => prod.id === orderItem.productId).price,
                productId: orderItem.productId,
                quantity: orderItem.quantity
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true
            }
          }
        }

      })


      return {
        ...order,
        OrderItem: order.OrderItem.map((item) => ({
          ...item,
          name: products.find(prod => prod.id === item.productId).name
        }))
      }

    } catch (error) {

      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Check logs'
      })

    }




    // return createOrderDto

    // return this.order.create({ data: createOrderDto })
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {


    const { status, page = 1, limit = 10 } = orderPaginationDto;

    const total = await this.order.count({ where: { status } });
    const pages = Math.ceil(total / limit);

    const order = await this.order.findMany({
      where: { status: status },
      skip: (page - 1) * limit,
      take: limit
    });

    return {
      data: order,
      meta: {
        total: total,
        page: page,
        lastPage: pages,
      }
    }

  }


  async findOne(id: string) {


    const order = await this.order.findUnique({
      where: { id: id }, include: {
        OrderItem: {
          select: {
            price: true,
            productId: true,
            quantity: true
          }
        }
      }
    })



    const product = await firstValueFrom(this.productCLient.send({ cmd: 'validate_product' }, order?.OrderItem.map(item => item.productId)))



    if (!order) throw new RpcException({
      status: HttpStatus.NOT_FOUND,
      message: `Order with id ${id} not found`
    });
    return {
      ...order,
      OrderItem: order.OrderItem.map(item => ({
        ...item,
        name: product.find(prod => prod.id === item.productId).name
      }))
    }

  }






  async changeOrderStatus(orderStatus: ChangeOrderStatusDto) {


    const { id, status } = orderStatus;

    const order = await this.findOne(id);

    if (order.status === status) return order;

    return this.order.update({
      where: { id: id },
      data: { status: status }
    });

  }
}
