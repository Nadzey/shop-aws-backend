import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class ProductServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Lambda for getting products list
        const getProductsListLambda = new lambda.Function(this, 'getProductsListHandler', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda'),
            handler: 'getProductsList.handler',
        });

        // Lambda for getting product by ID
        const getProductsByIdLambda = new lambda.Function(this, 'getProductsByIdHandler', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda'),
            handler: 'getProductsById.handler',
        });

        // API Gateway
        const api = new apigateway.RestApi(this, 'ProductServiceAPI', {
            restApiName: 'Product Service API',
        });

        // Create '/products' resource
        const products = api.root.addResource('products');
        products.addMethod('GET', new apigateway.LambdaIntegration(getProductsListLambda));

        // Create '/products/{productId}' resource
        const product = products.addResource('{productId}');
        product.addMethod('GET', new apigateway.LambdaIntegration(getProductsByIdLambda));
    }
}
