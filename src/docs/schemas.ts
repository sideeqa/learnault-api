/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         username:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         bio:
 *           type: string
 *         avatar:
 *           type: string
 *           format: url
 *         walletAddress:
 *           type: string
 *         isActive:
 *           type: boolean
 *         role:
 *           type: string
 *           enum: [LEARNER, EMPLOYER, ADMIN]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     UpdateUser:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         bio:
 *           type: string
 *         avatar:
 *           type: string
 *           format: url
 *
 *     RegisterInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - username
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *         username:
 *           type: string
 *         role:
 *           type: string
 *           enum: [LEARNER, EMPLOYER]
 *
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         token:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *
 *     AssetIdentity:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           example: XLM
 *         issuer:
 *           type: string
 *           nullable: true
 *           example: null
 *         decimals:
 *           type: integer
 *           example: 7
 *         network:
 *           type: string
 *           example: testnet
 *
 *     Module:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         category:
 *           type: string
 *         difficulty:
 *           type: string
 *         reward:
 *           type: number
 *         rewardAmountStroops:
 *           type: string
 *           example: "50000000"
 *         rewardFormatted:
 *           type: string
 *           example: "5.0000000"
 *         asset:
 *           $ref: '#/components/schemas/AssetIdentity'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         completionCount:
 *           type: integer
 *         userProgress:
 *           type: object
 *           nullable: true
 *           properties:
 *             completed:
 *               type: boolean
 *             score:
 *               type: number
 *             completedAt:
 *               type: string
 *               format: date-time
 *
 *     ModuleList:
 *       type: object
 *       properties:
 *         modules:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Module'
 *         pagination:
 *           $ref: '#/components/schemas/Pagination'
 *
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         total:
 *           type: integer
 *         totalPages:
 *           type: integer
 *         hasNext:
 *           type: boolean
 *         hasPrev:
 *           type: boolean
 *
 *     ModuleStartResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         moduleId:
 *           type: string
 *         startedAt:
 *           type: string
 *           format: date-time
 *
 *     CompleteModuleInput:
 *       type: object
 *       required:
 *         - quizAnswers
 *       properties:
 *         quizAnswers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               questionId:
 *                 type: string
 *               answer:
 *                 type: string
 *
 *     ModuleCompletionResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         score:
 *           type: number
 *         isEligibleForReward:
 *           type: boolean
 *         reward:
 *           type: number
 *         rewardAmountStroops:
 *           type: string
 *         rewardFormatted:
 *           type: string
 *         asset:
 *           $ref: '#/components/schemas/AssetIdentity'
 *         rewardTransaction:
 *           type: string
 *         completedAt:
 *           type: string
 *           format: date-time
 *
 *     RewardBalance:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             balance:
 *               type: object
 *               properties:
 *                 available:
 *                   type: number
 *                 availableStroops:
 *                   type: string
 *                 availableFormatted:
 *                   type: string
 *                 pending:
 *                   type: number
 *                 pendingStroops:
 *                   type: string
 *                 pendingFormatted:
 *                   type: string
 *                 lifetime:
 *                   type: number
 *                 lifetimeStroops:
 *                   type: string
 *                 lifetimeFormatted:
 *                   type: string
 *                 asset:
 *                   $ref: '#/components/schemas/AssetIdentity'
 *             updatedAt:
 *               type: string
 *               format: date-time
 *
 *     Transaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *         status:
 *           type: string
 *         amount:
 *           type: number
 *         amountStroops:
 *           type: string
 *         amountFormatted:
 *           type: string
 *         asset:
 *           $ref: '#/components/schemas/AssetIdentity'
 *         moduleId:
 *           type: string
 *         stellarTxHash:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *
 *     TransactionHistory:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             transactions:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *             pagination:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *                 hasMore:
 *                   type: boolean
 *
 *     WithdrawalInput:
 *       type: object
 *       required:
 *         - walletAddress
 *         - amount
 *       properties:
 *         walletAddress:
 *           type: string
 *         amount:
 *           oneOf:
 *             - type: string
 *               description: Decimal string (e.g. "5.0000000") or integer stroop string (e.g. "50000000")
 *             - type: integer
 *               description: Integer stroops (e.g. 50000000)
 *         memo:
 *           type: string
 *
 *     WithdrawalResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             transactionId:
 *               type: string
 *             amount:
 *               type: number
 *             stellarTxHash:
 *               type: string
 *             status:
 *               type: string
 *             requestedAt:
 *               type: string
 *               format: date-time
 *             completedAt:
 *               type: string
 *               format: date-time
 *
 *     Credential:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         holderName:
 *           type: string
 *         moduleId:
 *           type: string
 *         moduleName:
 *           type: string
 *         moduleDescription:
 *           type: string
 *         moduleCategory:
 *           type: string
 *         moduleDifficulty:
 *           type: string
 *         onChainId:
 *           type: string
 *         issuedAt:
 *           type: string
 *           format: date-time
 *         shareableLink:
 *           type: string
 *
 *     CredentialList:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Credential'
 *         meta:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             total:
 *               type: integer
 *             totalPages:
 *               type: integer
 *
 *     VerificationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             valid:
 *               type: boolean
 *             credential:
 *               type: object
 *             verification:
 *               type: object
 */
