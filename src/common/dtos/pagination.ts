import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsPositive } from "class-validator";



export class PaginationDto {
 
    
    @IsNumber()
    @IsPositive()
    @IsOptional()
    @Type(() => Number)
    page?: number;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @Type(() => Number)
    limit?: number;


}