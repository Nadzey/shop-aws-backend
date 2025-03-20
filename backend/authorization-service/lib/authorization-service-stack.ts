import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as path from "path";

export class AuthorizationServiceStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Define Lambda function
        const basicAuthorizer = new lambda.Function(this, "BasicAuthorizer", {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "basicAuthorizer.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "../lambda")),
            environment: {
                GITHUB_USERNAME: process.env.GITHUB_USERNAME || "",
                TEST_PASSWORD: process.env.TEST_PASSWORD || "TEST_PASSWORD"
            }
        });

        // Define API Gateway Authorizer
        new apigateway.TokenAuthorizer(this, "APIGatewayAuthorizer", {
            handler: basicAuthorizer,
            identitySource: "method.request.header.Authorization"
        });
    }
}
